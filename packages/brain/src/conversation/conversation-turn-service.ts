import { createHash, randomUUID } from 'node:crypto';

import type {
  BrainRequest,
  BrainRequestPurpose,
  BrainResponse,
  BrainDecisionType,
  ContextRecord,
  InformationState,
  PlanBlock,
  ModelRun,
  Channel,
} from '@jarvis/contracts';
import type { BrainRepository } from '@jarvis/database';
import { processProposedAction } from '@jarvis/domain';
import type { EventPipelineDependencies } from '@jarvis/domain';

import type { InterventionService } from '../behavior/intervention-service.js';
import type { ContextAssembler } from '../context/assembler.js';
import type { ModelGateway } from '../model/gateway.js';
import type { ModelBudgetGuard } from '../model/budget-guard.js';
import { selectModelRoute } from '../model/model-router.js';
import type { PromptAssembler } from '../prompts/assembler.js';
import { mapModelActions } from './action-mapper.js';
import { materializeModelDecision, ModelDecisionValidationError } from './model-decision-mapper.js';
import { opaqueOwnerReference, type BrainTelemetrySink } from '../observability/telemetry.js';

export interface ConversationCurrentState {
  readonly contextRecords: readonly ContextRecord[];
  readonly hardOverrideIds: readonly string[];
  readonly availableData: readonly { readonly domain: string; readonly state: InformationState }[];
  readonly existingPlanBlocks: readonly PlanBlock[];
  readonly availableDayPlanIds: readonly string[];
  readonly hasConflict: boolean;
  readonly highConsequence: boolean;
  readonly remainingDeepCalls: number;
  readonly maximumModelCalls: number;
  readonly callsAlreadyMade?: number;
  readonly dailyModelSpendEstimateUsd?: number;
  readonly dailyDeepCallsUsed?: number;
}

export interface ConversationTurnInput {
  readonly ownerId: string;
  readonly conversationId: string;
  readonly message: string;
  readonly timestamp: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly sourceEventId: string | null;
  readonly messageId?: string;
  readonly purpose?: BrainRequestPurpose;
  /** Channel is canonical metadata only; Brain never gains a transport client. */
  readonly channel?: Channel;
  /** Metadata is persisted locally but never forwarded wholesale to a model. */
  readonly channelMetadata: Readonly<Record<string, unknown>>;
  readonly currentState: ConversationCurrentState;
}

export interface ConversationTurnDependencies {
  readonly repository: BrainRepository;
  readonly gateway: ModelGateway;
  readonly contextAssembler: ContextAssembler;
  readonly promptAssembler: PromptAssembler;
  /** The standard Domain transaction + security policy boundary, never a model tool. */
  readonly actionPipeline: Pick<EventPipelineDependencies, 'store' | 'policy'>;
  readonly deepEscalationEnabled: boolean;
  readonly maxRecentMessages: number;
  readonly interventionService: InterventionService;
  readonly modelBudgetGuard?: ModelBudgetGuard;
  readonly telemetry?: BrainTelemetrySink;
}

function deterministicUuid(seed: string): string {
  const hex = createHash('sha256').update(seed, 'utf8').digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}

function failureResponse(input: {
  readonly requestId: string;
  readonly status: Extract<
    BrainResponse['status'],
    'not_configured' | 'provider_unavailable' | 'invalid_model_output' | 'failed'
  >;
  readonly safeError: string;
}): BrainResponse {
  return {
    requestId: input.requestId,
    status: input.status,
    decisionId: null,
    conversationResponse: null,
    responseMessageId: null,
    actionIds: [],
    approvalRequested: false,
    safeError: input.safeError,
  };
}

/**
 * Provider-neutral conversation orchestrator. It owns lifecycle order but is deliberately unable
 * to query a raw database, execute arbitrary code, send a channel message, or bypass policy.
 */
export class ConversationTurnService {
  public constructor(private readonly dependencies: ConversationTurnDependencies) {}

  public async process(input: ConversationTurnInput): Promise<BrainResponse> {
    const purpose = input.purpose ?? 'conversation';
    const channel = input.channel ?? 'internal';
    const messageId =
      input.messageId ??
      deterministicUuid(`brain-message:${input.ownerId}:${input.idempotencyKey}`);
    const request: BrainRequest = {
      id: deterministicUuid(`brain-request:${input.ownerId}:${input.idempotencyKey}`),
      ownerId: input.ownerId,
      conversationId: input.conversationId,
      sourceEventId: input.sourceEventId,
      messageId,
      purpose,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      causationId: input.causationId,
      requestedAt: input.timestamp,
      state: 'received',
    };

    await this.dependencies.repository.persistInboundMessage({
      id: messageId,
      ownerId: input.ownerId,
      conversationId: input.conversationId,
      sourceEventId: input.sourceEventId,
      correlationId: input.correlationId,
      occurredAt: input.timestamp,
      content: input.message,
      channel,
      metadata: { ...input.channelMetadata },
    });

    const persisted = await this.dependencies.repository.beginOrLoadRequest(request);
    if (persisted.duplicate) {
      const decision = await this.dependencies.repository.getDecisionForRequest({
        ownerId: input.ownerId,
        requestId: persisted.request.id,
      });
      // A canonical worker can crash after the response commits but before it projects its
      // transport outbox. Rehydrate the deterministic response so that a replay may create the
      // missing idempotent outbox row without a second model call or action.
      const persistedResponse = await this.dependencies.repository.getConversationResponse({
        ownerId: input.ownerId,
        responseMessageId: deterministicUuid(`brain-response:${persisted.request.id}`),
      });
      return {
        requestId: persisted.request.id,
        status: 'duplicate',
        decisionId: decision?.id ?? null,
        conversationResponse: persistedResponse?.response ?? null,
        responseMessageId: persistedResponse?.id ?? null,
        actionIds: [],
        approvalRequested: false,
        safeError: null,
      };
    }

    if (input.currentState.maximumModelCalls < 1) {
      await this.dependencies.repository.updateRequestState({
        ownerId: input.ownerId,
        requestId: request.id,
        state: 'failed',
        safeErrorCategory: 'model_call_budget_exhausted',
        completedAt: input.timestamp,
      });
      const response = failureResponse({
        requestId: request.id,
        status: 'failed',
        safeError: 'The model-call budget is exhausted for this reasoning cycle.',
      });
      await this.emitTelemetry({
        request,
        promptVersion: 'not_assembled',
        contextManifestId: null,
        modelRun: null,
        decisionType: null,
        validationSuccess: false,
        policyResult: 'not_applicable',
        actionCount: 0,
        errorCategory: 'model_call_budget_exhausted',
      });
      return response;
    }

    const repositoryRecords = await this.dependencies.repository.listContextRecords({
      ownerId: input.ownerId,
      conversationId: input.conversationId,
      maximumRecentMessages: this.dependencies.maxRecentMessages,
    });
    const context = this.dependencies.contextAssembler.assemble({
      request,
      now: input.timestamp,
      records: [...repositoryRecords, ...input.currentState.contextRecords],
      hardOverrideIds: input.currentState.hardOverrideIds,
      availableData: input.currentState.availableData,
    });
    const prompt = this.dependencies.promptAssembler.assemble({
      purpose,
      context,
      ownerMessage: input.message,
    });
    await this.dependencies.repository.persistContextManifest(context.manifest);
    await this.dependencies.repository.updateRequestState({
      ownerId: input.ownerId,
      requestId: request.id,
      state: 'context_assembled',
      promptVersion: prompt.version,
      contextVersion: context.manifest.contextVersion,
    });

    const route = selectModelRoute({
      purpose,
      hasConflict: input.currentState.hasConflict,
      highConsequence: input.currentState.highConsequence,
      deepEscalationEnabled: this.dependencies.deepEscalationEnabled,
      remainingDeepCalls: input.currentState.remainingDeepCalls,
    });
    const budgetDecision = this.dependencies.modelBudgetGuard?.evaluate(route, {
      callsAlreadyMade: input.currentState.callsAlreadyMade ?? 0,
      dailySpendEstimateUsd: input.currentState.dailyModelSpendEstimateUsd ?? 0,
      dailyDeepCallsUsed: input.currentState.dailyDeepCallsUsed ?? 0,
      approximatePromptTokens: context.manifest.promptTokenEstimate,
    });
    if (budgetDecision && !budgetDecision.allowed) {
      await this.dependencies.repository.updateRequestState({
        ownerId: input.ownerId,
        requestId: request.id,
        state: 'failed',
        safeErrorCategory: 'model_budget_exhausted',
        completedAt: input.timestamp,
      });
      const response = failureResponse({
        requestId: request.id,
        status: 'failed',
        safeError: budgetDecision.reason,
      });
      await this.emitTelemetry({
        request,
        promptVersion: prompt.version,
        contextManifestId: context.manifest.id,
        modelRun: null,
        decisionType: null,
        validationSuccess: false,
        policyResult: 'not_applicable',
        actionCount: 0,
        errorCategory: 'model_budget_exhausted',
      });
      return response;
    }
    await this.dependencies.repository.updateRequestState({
      ownerId: input.ownerId,
      requestId: request.id,
      state: 'model_requested',
    });
    const modelResult = await this.dependencies.gateway.decide({
      request,
      context,
      route,
      instructions: prompt.instructions,
      input: prompt.input,
    });
    await this.dependencies.repository.persistModelRun(modelResult.run);

    if (modelResult.status !== 'completed') {
      const status =
        modelResult.status === 'not_configured'
          ? 'not_configured'
          : modelResult.status === 'unavailable'
            ? 'provider_unavailable'
            : modelResult.status === 'invalid_model_output'
              ? 'invalid_model_output'
              : 'failed';
      await this.dependencies.repository.updateRequestState({
        ownerId: input.ownerId,
        requestId: request.id,
        state: status === 'not_configured' ? 'not_configured' : 'failed',
        safeErrorCategory: modelResult.run.errorCategory ?? modelResult.status,
        completedAt: input.timestamp,
      });
      const response = failureResponse({
        requestId: request.id,
        status,
        safeError: modelResult.safeError,
      });
      await this.emitTelemetry({
        request,
        promptVersion: prompt.version,
        contextManifestId: context.manifest.id,
        modelRun: modelResult.run,
        decisionType: null,
        validationSuccess: false,
        policyResult: 'not_applicable',
        actionCount: 0,
        errorCategory: modelResult.run.errorCategory ?? modelResult.status,
      });
      return response;
    }

    const decisionId = randomUUID();
    let materialized: ReturnType<typeof materializeModelDecision>;
    try {
      materialized = materializeModelDecision({
        rawDecision: modelResult.decision,
        context,
        decisionId,
        now: input.timestamp,
        existingPlanBlocks: input.currentState.existingPlanBlocks,
        allowedDayPlanIds: input.currentState.availableDayPlanIds,
        isSupportedIntervention: (interventionId) =>
          this.dependencies.interventionService.isSupported(interventionId),
      });
    } catch (error) {
      const safeError =
        error instanceof ModelDecisionValidationError
          ? 'The model response referenced invalid or unavailable structured state.'
          : 'The model response could not be safely materialized.';
      await this.dependencies.repository.updateRequestState({
        ownerId: input.ownerId,
        requestId: request.id,
        state: 'failed',
        safeErrorCategory: 'invalid_model_output',
        completedAt: input.timestamp,
      });
      const response = failureResponse({
        requestId: request.id,
        status: 'invalid_model_output',
        safeError,
      });
      await this.emitTelemetry({
        request,
        promptVersion: prompt.version,
        contextManifestId: context.manifest.id,
        modelRun: modelResult.run,
        decisionType: null,
        validationSuccess: false,
        policyResult: 'not_applicable',
        actionCount: 0,
        errorCategory: 'invalid_model_output',
      });
      return response;
    }

    await this.dependencies.repository.persistDecision({
      id: decisionId,
      ownerId: input.ownerId,
      brainRequestId: request.id,
      modelRunId: modelResult.run.id,
      decision: materialized.decision,
      promptVersion: prompt.version,
      contextVersion: context.manifest.contextVersion,
      validationState: 'validated',
      executionResult: { state: 'pending_action_processing' },
      correlationId: input.correlationId,
    });
    await this.dependencies.repository.updateRequestState({
      ownerId: input.ownerId,
      requestId: request.id,
      state: 'decision_persisted',
    });

    for (const candidate of materialized.memoryCandidates) {
      await this.dependencies.repository.persistMemoryCandidate(candidate);
      if (candidate.kind === 'constitution_candidate') {
        await this.dependencies.repository.persistConstitutionCandidate({
          candidate,
          correlationId: input.correlationId,
        });
      }
    }
    if (materialized.planProposal) {
      await this.dependencies.repository.persistPlanProposal({
        proposal: materialized.planProposal,
        sourceBrainDecisionId: decisionId,
        correlationId: input.correlationId,
      });
    }
    if (materialized.reminderProposal) {
      await this.dependencies.repository.persistReminderProposal({
        proposal: materialized.reminderProposal,
        sourceBrainDecisionId: decisionId,
        correlationId: input.correlationId,
      });
    }
    if (materialized.decision.interventionProposal) {
      await this.dependencies.interventionService.propose({
        ownerId: input.ownerId,
        proposal: materialized.decision.interventionProposal,
        sourceBrainDecisionId: decisionId,
        correlationId: input.correlationId,
        now: input.timestamp,
      });
    }
    if (materialized.decision.clarification) {
      await this.dependencies.repository.persistClarification({
        ownerId: input.ownerId,
        brainRequestId: request.id,
        clarification: materialized.decision.clarification,
        correlationId: input.correlationId,
      });
    }

    const mappedActions = mapModelActions({
      request,
      decisionId,
      intents: materialized.decision.proposedActions,
      planProposal: materialized.planProposal,
      reminderProposal: materialized.reminderProposal,
    });
    const actionIds: string[] = [];
    let approvalRequested = false;
    let deniedCount = 0;
    let executedCount = 0;
    let mappingErrorCount = 0;
    let actionProcessingError = false;
    for (const mapped of mappedActions) {
      if (mapped.mappingError) {
        mappingErrorCount += 1;
      }
      try {
        const result = await processProposedAction(this.dependencies.actionPipeline, {
          action: mapped.action,
          source: 'brain',
          reason:
            mapped.mappingError ?? 'A schema-validated brain decision proposed this typed action.',
        });
        actionIds.push(result.actionId);
        approvalRequested ||= result.approvalRequested;
        deniedCount += result.denied ? 1 : 0;
        executedCount += result.executed ? 1 : 0;
      } catch {
        // The action transaction has rolled back. Keep the validated decision, record only a safe
        // category, and never retry through an unbounded model loop.
        actionProcessingError = true;
      }
    }
    await this.dependencies.repository.updateDecisionExecutionResult({
      ownerId: input.ownerId,
      decisionId,
      executionResult: {
        actionCount: mappedActions.length,
        executedCount,
        deniedCount,
        approvalRequested,
        mappingErrorCount,
        actionProcessingError,
      },
    });

    const responseMessageId = materialized.decision.conversationResponse
      ? deterministicUuid(`brain-response:${request.id}`)
      : null;
    if (materialized.decision.conversationResponse && responseMessageId) {
      await this.dependencies.repository.persistConversationResponse({
        id: responseMessageId,
        ownerId: input.ownerId,
        conversationId: input.conversationId,
        sourceEventId: input.sourceEventId,
        correlationId: input.correlationId,
        occurredAt: input.timestamp,
        channel,
        response: materialized.decision.conversationResponse,
      });
    }
    await this.dependencies.repository.updateRequestState({
      ownerId: input.ownerId,
      requestId: request.id,
      state: 'completed',
      completedAt: input.timestamp,
    });

    const response: BrainResponse = {
      requestId: request.id,
      status: 'completed',
      decisionId,
      conversationResponse: materialized.decision.conversationResponse,
      responseMessageId,
      actionIds,
      approvalRequested,
      safeError: actionProcessingError
        ? 'One or more internal action proposals could not be applied and were not retried automatically.'
        : null,
    };
    await this.emitTelemetry({
      request,
      promptVersion: prompt.version,
      contextManifestId: context.manifest.id,
      modelRun: modelResult.run,
      decisionType: materialized.decision.decisionType,
      validationSuccess: true,
      policyResult: approvalRequested
        ? 'approval'
        : deniedCount > 0
          ? 'denied'
          : executedCount > 0
            ? 'allowed'
            : 'not_applicable',
      actionCount: mappedActions.length,
      errorCategory: actionProcessingError ? 'internal_action_failed' : null,
    });
    return response;
  }

  private async emitTelemetry(input: {
    readonly request: BrainRequest;
    readonly promptVersion: string;
    readonly contextManifestId: string | null;
    readonly modelRun: ModelRun | null;
    readonly decisionType: BrainDecisionType | null;
    readonly validationSuccess: boolean;
    readonly policyResult: 'allowed' | 'approval' | 'denied' | 'not_applicable';
    readonly actionCount: number;
    readonly errorCategory: string | null;
  }): Promise<void> {
    if (!this.dependencies.telemetry) {
      return;
    }
    try {
      await this.dependencies.telemetry.record({
        brainRequestId: input.request.id,
        correlationId: input.request.correlationId,
        ownerReference: opaqueOwnerReference(input.request.ownerId),
        promptVersion: input.promptVersion,
        contextManifestId: input.contextManifestId,
        modelRoute: input.modelRun?.route ?? null,
        modelId: input.modelRun?.actualModelId ?? null,
        latencyMs: input.modelRun?.latencyMs ?? null,
        inputTokens: input.modelRun?.inputTokens ?? null,
        outputTokens: input.modelRun?.outputTokens ?? null,
        estimatedCostUsd: input.modelRun?.estimatedCostUsd ?? null,
        decisionType: input.decisionType,
        validationSuccess: input.validationSuccess,
        policyResult: input.policyResult,
        actionCount: input.actionCount,
        errorCategory: input.errorCategory,
      });
    } catch {
      // Observability must never change a brain decision or suppress its local response.
    }
  }
}
