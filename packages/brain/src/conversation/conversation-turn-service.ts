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
  OwnerBaselineOperation,
} from '@jarvis/contracts';
import type { BrainRepository } from '@jarvis/database';
import { processProposedAction } from '@jarvis/domain';
import { CanonicalPlanValidationError } from '@jarvis/contracts';
import type { EventPipelineDependencies } from '@jarvis/domain';

import type { InterventionService } from '../behavior/intervention-service.js';
import type { ContextAssembler } from '../context/assembler.js';
import { modelDecisionEnvelopeSchema } from '../model/decision-schema.js';
import type { ModelGateway } from '../model/gateway.js';
import type {
  ModelBudgetGuard,
  ZeroCostCreditAccounting,
  ZeroCostCreditAccountingSource,
} from '../model/budget-guard.js';
import {
  selectModelRoute,
  selectOwnerChatReasoning,
  type OwnerChatRoutingDecision,
} from '../model/model-router.js';
import type { PromptAssembler } from '../prompts/assembler.js';
import {
  mapModelActions,
  materializeValidatedPlanAction,
  materializeValidatedReminderAction,
} from './action-mapper.js';
import { materializeModelDecision, ModelDecisionValidationError } from './model-decision-mapper.js';
import {
  detectOwnerTurnFeedback,
  feedbackInstruction,
  ownerFeedbackReceipt,
} from './owner-feedback.js';
import { evaluateDailyUseAccountability } from './daily-use-accountability.js';
import {
  isOwnerBaselineCapture,
  ownerBaselineControl,
  extractOwnerBaselineProposals,
} from './owner-baseline.js';
import { opaqueOwnerReference, type BrainTelemetrySink } from '../observability/telemetry.js';
import { reconcileConversationResponse, type MutationOutcome } from './outcome-response.js';

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
  /** Trusted owner-intent allowlist; never sourced from model output. Empty means no new free-form creation. */
  readonly authorizedNewFlexibleBlockTitles?: readonly string[];
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
  /**
   * A trusted canonical transport may persist and deduplicate inbound evidence before asking the
   * Brain to reason. In that case the existing canonical message ID is attached to this request
   * and no second inbound message row is created.
   */
  readonly inboundAlreadyPersisted?: boolean;
  readonly purpose?: BrainRequestPurpose;
  /** Channel is canonical metadata only; Brain never gains a transport client. */
  readonly channel?: Channel;
  /** Metadata is persisted locally but never forwarded wholesale to a model. */
  readonly channelMetadata: Readonly<Record<string, unknown>>;
  readonly currentState: ConversationCurrentState;
}

export interface ConversationTurnDependencies {
  readonly casualChatRoutingEnabled?: boolean;
  readonly routingTelemetry?: (
    record: OwnerChatRoutingDecision & {
      readonly requestId: string;
      readonly phase: 'selected' | 'model_completed';
      readonly latencyMs: number;
    },
  ) => Promise<void> | void;
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
  /** Optional outside zero-cost Vercel composition; absence fails closed when that mode is active. */
  readonly zeroCostCreditAccounting?: ZeroCostCreditAccountingSource;
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

    if (!input.inboundAlreadyPersisted) {
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
    }

    const verifiedOwnerTurn =
      input.channelMetadata.ownerVerified === true &&
      input.channelMetadata.conversationType === 'direct' &&
      ((channel === 'telegram' && input.channelMetadata.transport === 'telegram_bot') ||
        (channel === 'whatsapp' && input.channelMetadata.transport === 'cloud_api'));
    const ownerFeedback = verifiedOwnerTurn ? detectOwnerTurnFeedback(input.message) : null;
    const baselineReview = verifiedOwnerTurn
      ? ((await this.dependencies.repository.loadOwnerBaselineReview?.({
          ownerId: input.ownerId,
          conversationId: input.conversationId,
          now: input.timestamp,
        })) ?? null)
      : null;
    const baselineControl =
      verifiedOwnerTurn && this.dependencies.repository.finalizeOwnerBaselineTurn
        ? ownerBaselineControl({
            message: input.message,
            review: baselineReview,
            questionnaireId: deterministicUuid(
              `owner-baseline-placeholder:${input.ownerId}:${input.conversationId}`,
            ),
            timezone: /temporary|geçici|until/iu.test(input.message)
              ? ((await this.dependencies.repository.loadOwnerTimezone?.({
                  ownerId: input.ownerId,
                })) ?? null)
              : null,
          })
        : null;
    const baselineCapture =
      verifiedOwnerTurn &&
      this.dependencies.repository.finalizeOwnerBaselineTurn &&
      isOwnerBaselineCapture(input.message);
    const persisted = await this.dependencies.repository.beginOrLoadRequest(request);
    if (persisted.duplicate) {
      await this.dependencies.repository.recoverOwnerBaselineTurn?.({
        ownerId: input.ownerId,
        requestId: persisted.request.id,
        responseMessageId: deterministicUuid(`brain-response:${persisted.request.id}`),
      });
      await this.dependencies.repository.recoverDailyUseTurn?.({
        ownerId: input.ownerId,
        requestId: persisted.request.id,
        responseMessageId: deterministicUuid(`brain-response:${persisted.request.id}`),
      });
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
      // A feedback receipt is provider-free: if staging failed after its evidence committed,
      // recover it below from the exact canonical inbound/candidate rather than abandon the turn.
      if (persistedResponse || (!ownerFeedback && !baselineControl) || decision)
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

    const persistFailure = async (failure: BrainResponse): Promise<BrainResponse> => {
      const response = {
        message: `The requested change could not be applied. ${failure.safeError ?? 'The request could not be completed safely.'}`,
        nextAction: null,
        tone: 'neutral' as const,
      };
      const id = deterministicUuid(`brain-response:${request.id}`);
      await this.dependencies.repository.persistConversationResponse({
        id,
        ownerId: input.ownerId,
        conversationId: input.conversationId,
        sourceEventId: input.sourceEventId,
        correlationId: input.correlationId,
        occurredAt: input.timestamp,
        channel,
        response,
      });
      return { ...failure, conversationResponse: response, responseMessageId: id };
    };

    const finishBaseline = async (
      operation: OwnerBaselineOperation,
      run: ModelRun | null,
      promptVersion: string,
      contextVersion: string,
    ): Promise<BrainResponse> => {
      // This ID uses the same canonical algorithm as the database onboarding identity.
      const hex = createHash('sha256')
        .update(`owner-baseline-v1:${input.ownerId}:${input.conversationId}`)
        .digest('hex');
      const questionnaireId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
      const decisionId = deterministicUuid(`owner-baseline-decision:${request.id}`);
      const responseMessageId = deterministicUuid(`brain-response:${request.id}`);
      await this.dependencies.repository.persistDecision({
        id: decisionId,
        ownerId: input.ownerId,
        brainRequestId: request.id,
        modelRunId: run?.id ?? null,
        promptVersion,
        contextVersion,
        validationState: 'validated',
        correlationId: input.correlationId,
        executionResult: {
          ownerBaselineFinalization: 1,
          ownerBaselineOperation: { ...operation, questionnaireId },
          responseMessageId,
          actionCount: 0,
        },
        decision: {
          decisionType: 'capture',
          conversationResponse: null,
          reasoningSummary: {
            decisionSummary:
              'Owner-authored bounded baseline review; activation requires canonical explicit owner confirmation.',
            importantEvidenceIds: [messageId],
            materialTradeoffs: [],
            confidenceBasisPoints: 10_000,
            missingInformation: [],
          },
          evidence: [],
          clarification: null,
          proposedActions: [],
          memoryCandidates: [],
          planProposal: null,
          reminderProposal: null,
          interventionProposal: null,
        },
      });
      const response = await this.dependencies.repository.finalizeOwnerBaselineTurn!({
        ownerId: input.ownerId,
        requestId: request.id,
        decisionId,
        responseMessageId,
      });
      await this.emitTelemetry({
        request,
        promptVersion,
        contextManifestId: null,
        modelRun: run,
        decisionType: 'capture',
        validationSuccess: true,
        policyResult: 'not_applicable',
        actionCount: 0,
        errorCategory: null,
      });
      return {
        requestId: request.id,
        status: 'completed',
        decisionId,
        responseMessageId,
        conversationResponse: response,
        actionIds: [],
        approvalRequested: false,
        safeError: null,
      };
    };
    if (baselineControl)
      return finishBaseline(
        baselineControl,
        null,
        'owner-baseline-review-v1',
        'owner-baseline-review-v1',
      );

    const recordedFeedback = ownerFeedback
      ? await this.dependencies.repository.recordOwnerFeedback?.({
          ownerId: input.ownerId,
          conversationId: input.conversationId,
          messageId,
          sourceEventId: input.sourceEventId,
          correlationId: input.correlationId,
          occurredAt: input.timestamp,
          channel,
          feedback: ownerFeedback,
        })
      : null;
    if (ownerFeedback && recordedFeedback) {
      const decisionId = deterministicUuid(`owner-feedback-decision:${request.id}`);
      const responseMessageId = deterministicUuid(`brain-response:${request.id}`);
      const response = ownerFeedbackReceipt(ownerFeedback);
      await this.dependencies.repository.persistDecision({
        id: decisionId,
        ownerId: input.ownerId,
        brainRequestId: request.id,
        modelRunId: null,
        promptVersion: 'owner-feedback-v1',
        contextVersion: 'owner-feedback-v1',
        validationState: 'validated',
        correlationId: input.correlationId,
        executionResult: {
          ownerFeedback: recordedFeedback,
          actionCount: 0,
          finalConversationResponse: response,
          dailyUseFinalization: 1,
          responseMessageId,
        },
        decision: {
          decisionType: 'capture',
          conversationResponse: response,
          reasoningSummary: {
            decisionSummary:
              'Recorded bounded explicit owner feedback without model inference or actions.',
            importantEvidenceIds: [],
            materialTradeoffs: [],
            confidenceBasisPoints: 10_000,
            missingInformation: [],
          },
          evidence: [],
          clarification: null,
          proposedActions: [],
          memoryCandidates: [],
          planProposal: null,
          reminderProposal: null,
          interventionProposal: null,
        },
      });
      const persistedResponse = {
        id: responseMessageId,
        ownerId: input.ownerId,
        conversationId: input.conversationId,
        sourceEventId: input.sourceEventId,
        correlationId: input.correlationId,
        occurredAt: input.timestamp,
        channel,
        response,
      };
      if (this.dependencies.repository.finalizeDailyUseTurn)
        await this.dependencies.repository.finalizeDailyUseTurn({
          requestId: request.id,
          decisionId,
          response: persistedResponse,
          challengeCommitmentId: null,
          ownerOverride: null,
        });
      else {
        await this.dependencies.repository.persistConversationResponse(persistedResponse);
        await this.dependencies.repository.updateRequestState({
          ownerId: input.ownerId,
          requestId: request.id,
          state: 'completed',
          promptVersion: 'owner-feedback-v1',
          contextVersion: 'owner-feedback-v1',
          completedAt: input.timestamp,
        });
      }
      await this.emitTelemetry({
        request,
        promptVersion: 'owner-feedback-v1',
        contextManifestId: null,
        modelRun: null,
        decisionType: 'capture',
        validationSuccess: true,
        policyResult: 'not_applicable',
        actionCount: 0,
        errorCategory: null,
      });
      return {
        requestId: request.id,
        status: 'completed',
        decisionId,
        responseMessageId,
        conversationResponse: response,
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
      return persistFailure(response);
    }

    const repositoryRecords = await this.dependencies.repository.listContextRecords({
      ownerId: input.ownerId,
      conversationId: input.conversationId,
      maximumRecentMessages: this.dependencies.maxRecentMessages,
    });
    const dailyUse = verifiedOwnerTurn
      ? await this.dependencies.repository.loadDailyUseState?.({
          ownerId: input.ownerId,
          now: input.timestamp,
          ownerMessage: input.message,
        })
      : undefined;
    const accountability =
      ownerFeedback || baselineCapture
        ? null
        : evaluateDailyUseAccountability(input.message, dailyUse?.commitments ?? []);
    const tuningRecords: ContextRecord[] = [];
    if (ownerFeedback && recordedFeedback)
      tuningRecords.push({
        recordId: recordedFeedback.candidateId,
        recordType: 'owner_turn_feedback',
        ownerId: input.ownerId,
        source: 'canonical_owner_feedback',
        informationState: 'known',
        confidenceBasisPoints: 10_000,
        sensitivity: 'sensitive',
        observedAt: input.timestamp,
        content: JSON.stringify({
          ...ownerFeedback,
          ...recordedFeedback,
          instruction: feedbackInstruction(ownerFeedback),
        }),
        entityReferences: recordedFeedback.targetResponseId
          ? [recordedFeedback.targetResponseId]
          : [],
        constitutionalRelevance: 0,
        activeCommitmentRelevance: 0,
        deadlineProximityMinutes: null,
        currentDayRelevance: 100,
        sourceAuthority: 100,
      });
    if (accountability)
      tuningRecords.push({
        recordId: deterministicUuid(`accountability-context:${request.id}`),
        recordType: 'accountability_guidance',
        ownerId: input.ownerId,
        source: 'canonical_accountability_engine',
        informationState: 'known',
        confidenceBasisPoints: 10_000,
        sensitivity: 'sensitive',
        observedAt: input.timestamp,
        content: JSON.stringify({
          ...accountability,
          instruction:
            'Use this bounded outcome to word the reply. Preserve the commitment. No action happened. If challengeLevel is none, do not challenge again. Explain a material hard-override consequence at most once.',
        }),
        entityReferences: [accountability.commitmentId],
        constitutionalRelevance: 0,
        activeCommitmentRelevance: 100,
        deadlineProximityMinutes: null,
        currentDayRelevance: 100,
        sourceAuthority: 100,
      });
    const context = this.dependencies.contextAssembler.assemble({
      request,
      now: input.timestamp,
      records: [
        ...repositoryRecords,
        ...input.currentState.contextRecords,
        ...(dailyUse?.records ?? []),
        ...tuningRecords,
      ],
      hardOverrideIds: [
        ...input.currentState.hardOverrideIds,
        ...(dailyUse?.hardOverrideIds ?? []),
      ],
      availableData: input.currentState.availableData,
    });
    const prompt = this.dependencies.promptAssembler.assemble({
      purpose,
      context,
      ownerMessage: input.message,
      ...(baselineCapture ? { ownerBaseline: true } : {}),
      // Only the canonical owner-DM processor reaches this exact trusted metadata shape. The
      // model never receives the metadata itself; it receives a versioned presentation module.
      ...(input.channel === 'whatsapp' &&
      input.channelMetadata.transport === 'cloud_api' &&
      input.channelMetadata.conversationType === 'direct' &&
      input.channelMetadata.ownerVerified === true
        ? { presentation: 'whatsapp_owner' as const }
        : input.channel === 'telegram' &&
            input.channelMetadata.transport === 'telegram_bot' &&
            input.channelMetadata.conversationType === 'direct' &&
            input.channelMetadata.ownerVerified === true
          ? { presentation: 'telegram_owner' as const }
          : {}),
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
    const routingStartedAt = Date.now();
    // Missing/unreadable safety data can never authorize the cheaper reasoning profile.
    let routingSafety = { hasConflict: true, materialUncertainty: true };
    let safetyVerified = false;
    if (this.dependencies.casualChatRoutingEnabled && route === 'standard') {
      try {
        const verified = await this.dependencies.repository.loadOwnerChatRoutingSafety?.({
          ownerId: input.ownerId,
        });
        if (verified) {
          routingSafety = verified;
          safetyVerified = true;
        }
      } catch {
        /* Fall closed to the existing route. */
      }
    }
    const trustedOwnerSurface =
      (input.channel === 'telegram' && input.channelMetadata.transport === 'telegram_bot') ||
      (input.channel === 'whatsapp' && input.channelMetadata.transport === 'cloud_api');
    const chatRouting =
      this.dependencies.casualChatRoutingEnabled && route === 'standard'
        ? selectOwnerChatReasoning({
            purpose,
            safetyVerified,
            verifiedOwner: trustedOwnerSurface && input.channelMetadata.ownerVerified === true,
            directPrivate:
              trustedOwnerSurface && input.channelMetadata.conversationType === 'direct',
            message: input.message,
            hasConflict:
              routingSafety.hasConflict ||
              input.currentState.hasConflict ||
              [...repositoryRecords, ...input.currentState.contextRecords].some(
                (record) => record.informationState === 'conflicting',
              ),
            highConsequence: input.currentState.highConsequence,
            materialUncertainty:
              routingSafety.materialUncertainty ||
              input.currentState.availableData.some((domain) => domain.state === 'conflicting') ||
              [...repositoryRecords, ...input.currentState.contextRecords].some(
                (record) =>
                  record.informationState === 'inferred' ||
                  record.informationState === 'stale' ||
                  (record.recordType === 'message' &&
                    /\b(pending|awaiting approval|could not be applied|uncertain|not verified|chest pain|suicid|medication|transfer money)\b/iu.test(
                      record.content,
                    )),
              ),
          })
        : undefined;
    if (chatRouting) {
      try {
        await this.dependencies.routingTelemetry?.({
          ...chatRouting,
          requestId: request.id,
          phase: 'selected',
          latencyMs: Date.now() - routingStartedAt,
        });
      } catch {
        /* Telemetry cannot fail a turn. */
      }
    }
    let zeroCostCreditAccounting: ZeroCostCreditAccounting | undefined;
    const budgetGuard = this.dependencies.modelBudgetGuard;
    const gatewayRequest = {
      request,
      context,
      route,
      ...(chatRouting?.reasoningLevel === 'low' ? { reasoningEffortOverride: 'low' as const } : {}),
      instructions: prompt.instructions,
      input: prompt.input,
    };
    const admission =
      this.dependencies.gateway.preflight && budgetGuard
        ? await this.dependencies.gateway.preflight(gatewayRequest, {
            dynamicContextBudgetTokens: budgetGuard.dynamicContextBudgetTokens(),
          })
        : undefined;
    if (admission) {
      let accountingSafe = !admission.allowed;
      if (admission.allowed) {
        try {
          accountingSafe =
            (await this.dependencies.repository.loadModelAccountingSafety?.({
              ownerId: input.ownerId,
              modelId: admission.modelId,
              admission,
            })) ?? false;
        } catch {
          accountingSafe = false;
        }
      }
      await this.dependencies.repository.updateRequestState({
        ownerId: input.ownerId,
        requestId: request.id,
        state: 'context_assembled',
        admission,
      });
      if (!accountingSafe) {
        const safeError =
          'The canonical model accounting profile is unavailable or has a prior usage-bound violation. No model call was made.';
        await this.dependencies.repository.updateRequestState({
          ownerId: input.ownerId,
          requestId: request.id,
          state: 'failed',
          admission: {
            ...admission,
            allowed: false,
            errorCategory: 'model_accounting_unverified',
            reason: safeError,
          },
          safeErrorCategory: 'model_accounting_unverified',
          completedAt: input.timestamp,
        });
        return persistFailure(
          failureResponse({ requestId: request.id, status: 'failed', safeError }),
        );
      }
      if (!admission.allowed) {
        await this.dependencies.repository.updateRequestState({
          ownerId: input.ownerId,
          requestId: request.id,
          state: 'failed',
          safeErrorCategory: admission.errorCategory ?? 'request_admission_denied',
          completedAt: input.timestamp,
        });
        return persistFailure(
          failureResponse({ requestId: request.id, status: 'failed', safeError: admission.reason }),
        );
      }
    }
    const accountingSnapshotAsOf = budgetGuard?.zeroCostCreditAccountingSnapshotAsOf();
    if (
      budgetGuard?.requiresZeroCostCreditAccounting() &&
      accountingSnapshotAsOf &&
      this.dependencies.zeroCostCreditAccounting
    ) {
      try {
        zeroCostCreditAccounting =
          await this.dependencies.zeroCostCreditAccounting.loadZeroCostCreditAccounting({
            ownerId: input.ownerId,
            afterExclusive: accountingSnapshotAsOf,
          });
      } catch {
        // The guard below interprets an unavailable canonical ledger as an explicit no-request
        // result. Never estimate from process memory or make a provider call to find out.
        zeroCostCreditAccounting = undefined;
      }
    }
    const budgetDecision = budgetGuard?.evaluate(route, {
      callsAlreadyMade: input.currentState.callsAlreadyMade ?? 0,
      dailySpendEstimateUsd: input.currentState.dailyModelSpendEstimateUsd ?? 0,
      dailyDeepCallsUsed: input.currentState.dailyDeepCallsUsed ?? 0,
      approximatePromptTokens: context.manifest.promptTokenEstimate,
      ...(admission ? { admission } : {}),
      ...(zeroCostCreditAccounting ? { zeroCostCreditAccounting } : {}),
    });
    if (budgetDecision && !budgetDecision.allowed) {
      const unavailable = budgetDecision.failureStatus === 'provider_unavailable';
      await this.dependencies.repository.updateRequestState({
        ownerId: input.ownerId,
        requestId: request.id,
        state: 'failed',
        safeErrorCategory: unavailable ? 'free_tier_unavailable' : 'model_budget_exhausted',
        completedAt: input.timestamp,
      });
      const response = failureResponse({
        requestId: request.id,
        status: unavailable ? 'provider_unavailable' : 'failed',
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
        errorCategory: unavailable ? 'free_tier_unavailable' : 'model_budget_exhausted',
      });
      return persistFailure(response);
    }
    await this.dependencies.repository.updateRequestState({
      ownerId: input.ownerId,
      requestId: request.id,
      state: 'model_requested',
    });
    const modelResult = await this.dependencies.gateway.decide({
      ...gatewayRequest,
      ...(admission ? { admission } : {}),
    });
    if (chatRouting) {
      try {
        await this.dependencies.routingTelemetry?.({
          ...chatRouting,
          requestId: request.id,
          phase: 'model_completed',
          latencyMs: modelResult.run.latencyMs ?? 0,
        });
      } catch {
        /* Telemetry cannot fail a turn. */
      }
    }
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
      return persistFailure(response);
    }

    const decisionId = randomUUID();
    let materialized: ReturnType<typeof materializeModelDecision>;
    try {
      const envelope = modelDecisionEnvelopeSchema.parse(modelResult.decision);
      if (baselineCapture) {
        const proposals = extractOwnerBaselineProposals(envelope, input.message, messageId);
        return await finishBaseline(
          {
            questionnaireId: baselineReview?.questionnaireId ?? request.id,
            expectedRevision: baselineReview?.revision ?? null,
            operation: 'stage',
            proposals: [...proposals],
            ordinal: null,
            replacement: null,
            validUntil: null,
            pendingCorrection: null,
          },
          modelResult.run,
          prompt.version,
          context.manifest.contextVersion,
        );
      }
      const commitmentIds = [
        ...(envelope.planProposal?.operations.map((operation) => operation.commitmentId) ?? []),
        ...(envelope.reminderProposal?.commitmentId
          ? [envelope.reminderProposal.commitmentId]
          : []),
      ];
      const canonicalCommitments =
        commitmentIds.length > 0
          ? ((await this.dependencies.repository.loadPlanningCommitments?.({
              ownerId: input.ownerId,
              commitmentIds,
            })) ?? [])
          : [];
      materialized = materializeModelDecision({
        ownerMessage: input.message,
        canonicalCommitments,
        authorizedNewFlexibleBlockTitles: input.currentState.authorizedNewFlexibleBlockTitles,
        // Feedback is evidence about a turn, never a tool request or a second model-authored memory subsystem.
        rawDecision:
          ownerFeedback || accountability?.explicitHardOverride
            ? {
                ...envelope,
                proposedActions: [],
                memoryCandidates: [],
                planProposal: null,
                reminderProposal: null,
                interventionProposal: null,
              }
            : modelResult.decision,
        context,
        decisionId,
        now: input.timestamp,
        existingPlanBlocks: input.currentState.existingPlanBlocks,
        allowedDayPlanIds: input.currentState.availableDayPlanIds,
        ownerReminderSource: {
          deliveryAvailable: envelope.reminderProposal
            ? ((await this.dependencies.repository.canScheduleOwnerReminder?.({
                ownerId: input.ownerId,
                sourceEventId: input.sourceEventId,
              })) ?? false)
            : false,
          message: input.message,
          requestedAt: input.timestamp,
          timezone: envelope.reminderProposal
            ? ((await this.dependencies.repository.loadOwnerTimezone?.({
                ownerId: input.ownerId,
              })) ?? null)
            : null,
        },
        isSupportedIntervention: (interventionId) =>
          this.dependencies.interventionService.isSupported(interventionId),
      });
    } catch (error) {
      if (
        baselineCapture &&
        (await this.dependencies.repository.getDecisionForRequest({
          ownerId: input.ownerId,
          requestId: request.id,
        }))
      )
        throw error;
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
      return persistFailure(response);
    }

    const proposalOutcomes: MutationOutcome[] = [];
    if (materialized.planProposal)
      proposalOutcomes.push({
        subject: 'plan',
        state: materialized.planProposal.valid ? 'pending' : 'rejected',
      });
    if (materialized.reminderProposal)
      proposalOutcomes.push({ subject: 'reminder', state: 'pending' });
    if (materialized.decision.proposedActions.length > 0 && proposalOutcomes.length === 0) {
      proposalOutcomes.push({ subject: 'action', state: 'pending' });
    }
    await this.dependencies.repository.persistDecision({
      id: decisionId,
      ownerId: input.ownerId,
      brainRequestId: request.id,
      modelRunId: modelResult.run.id,
      decision: {
        ...materialized.decision,
        conversationResponse: reconcileConversationResponse(
          materialized.decision.conversationResponse,
          proposalOutcomes,
        ),
      },
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
    let interventionSuppressed =
      (dailyUse?.quietModeActive === true && Boolean(materialized.decision.interventionProposal)) ||
      accountability?.outcome.kind === 'accept_explicit_hard_override' ||
      (accountability?.outcome.challengeLevel === 'none' &&
        !accountability.explicitHardOverride &&
        accountability.outcome.kind !== 'ask_one_clarification');
    if (materialized.decision.interventionProposal && !interventionSuppressed) {
      const intervention = await this.dependencies.interventionService.propose({
        ownerId: input.ownerId,
        proposal: materialized.decision.interventionProposal,
        sourceBrainDecisionId: decisionId,
        correlationId: input.correlationId,
        now: input.timestamp,
      });
      interventionSuppressed = intervention.state === 'suppressed';
    }
    if (materialized.decision.clarification) {
      await this.dependencies.repository.persistClarification({
        ownerId: input.ownerId,
        brainRequestId: request.id,
        clarification: materialized.decision.clarification,
        correlationId: input.correlationId,
      });
    }

    const serverPlanAction = materializeValidatedPlanAction({
      request,
      decisionId,
      planProposal: materialized.planProposal,
    });
    const serverReminderAction = materializeValidatedReminderAction({
      request,
      decisionId,
      reminderProposal: materialized.reminderProposal,
    });
    // A valid operation proposal is sufficient for the server to construct the one plan action.
    // Ignore a redundant model plan-update intent so model compliance can neither enable nor
    // duplicate this mutation path.
    // Reminder v2 uses semantic intent only. Raw model actions remain in decision audit, never
    // become competing executable aliases or a second reminder action.
    const modelIntents = serverReminderAction
      ? []
      : materialized.decision.proposedActions.filter(
          (intent) => !(serverPlanAction && intent.actionType === 'internal.plan.update'),
        );
    const mappedModelActions = mapModelActions({
      request,
      decisionId,
      intents: modelIntents,
      planProposal: materialized.planProposal,
      reminderProposal: materialized.reminderProposal,
    });
    const mappedActions = [
      ...mappedModelActions.map((mapped, index) => ({
        mapped,
        actionType: modelIntents[index]?.actionType,
        serverMaterializedPlan: false,
        serverMaterializedReminder: false,
      })),
      ...(serverPlanAction
        ? [
            {
              mapped: serverPlanAction,
              actionType: 'internal.plan.update' as const,
              serverMaterializedPlan: true,
              serverMaterializedReminder: false,
            },
          ]
        : []),
      ...(serverReminderAction
        ? [
            {
              mapped: serverReminderAction,
              actionType: 'internal.reminder.create',
              serverMaterializedPlan: false,
              serverMaterializedReminder: true,
            },
          ]
        : []),
    ];
    const actionIds: string[] = [];
    let approvalRequested = false;
    let deniedCount = 0;
    let executedCount = 0;
    let verifiedCount = 0;
    let authorizedCount = 0;
    let mappingErrorCount = 0;
    let actionProcessingError = false;
    const actionOutcomes: MutationOutcome[] = [];
    const actionTransitions: {
      readonly actionId: string;
      readonly actionType: string;
      readonly origin:
        'model' | 'server_validated_plan_operation' | 'server_validated_reminder_intent';
      readonly policy: 'allowed' | 'approval' | 'denied';
      readonly execution: 'executed' | 'not_executed';
      readonly verification: 'verified' | 'not_required' | 'unverified';
    }[] = [];
    for (const {
      mapped,
      actionType,
      serverMaterializedPlan,
      serverMaterializedReminder,
    } of mappedActions) {
      const subject: MutationOutcome['subject'] =
        actionType === 'internal.plan.update'
          ? 'plan'
          : actionType === 'internal.reminder.create'
            ? 'reminder'
            : 'action';
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
        authorizedCount += result.evaluation.allowed ? 1 : 0;
        let verified = result.executed;
        if (result.executed && serverMaterializedPlan && materialized.planProposal) {
          verified =
            (await this.dependencies.repository.verifyAppliedPlanOperation?.({
              ownerId: input.ownerId,
              proposal: materialized.planProposal,
            })) ?? false;
          verifiedCount += verified ? 1 : 0;
        }
        if (result.executed && serverMaterializedReminder && materialized.reminderProposal) {
          verified =
            (await this.dependencies.repository.verifyScheduledReminder?.({
              ownerId: input.ownerId,
              proposal: materialized.reminderProposal,
            })) ?? false;
          verifiedCount += verified ? 1 : 0;
        }
        actionTransitions.push({
          actionId: result.actionId,
          actionType: mapped.action.actionType,
          origin: serverMaterializedPlan
            ? 'server_validated_plan_operation'
            : serverMaterializedReminder
              ? 'server_validated_reminder_intent'
              : 'model',
          policy: result.denied ? 'denied' : result.approvalRequested ? 'approval' : 'allowed',
          execution: result.executed ? 'executed' : 'not_executed',
          verification:
            serverMaterializedPlan || serverMaterializedReminder
              ? verified
                ? 'verified'
                : 'unverified'
              : 'not_required',
        });
        actionOutcomes.push({
          subject,
          state:
            mapped.mappingError || result.denied
              ? 'rejected'
              : result.executed && verified
                ? 'applied'
                : result.approvalRequested
                  ? 'pending'
                  : 'unknown',
        });
      } catch (error) {
        // The action transaction has rolled back. Keep the validated decision, record only a safe
        // category, and never retry through an unbounded model loop.
        actionProcessingError = true;
        actionOutcomes.push({
          subject,
          state: error instanceof CanonicalPlanValidationError ? 'rejected' : 'unknown',
        });
      }
    }
    const finalOutcomes = [
      ...proposalOutcomes.filter(
        (proposal) =>
          proposal.state === 'rejected' ||
          !actionOutcomes.some((action) => action.subject === proposal.subject),
      ),
      ...actionOutcomes,
    ];
    const finalConversationResponse = reconcileConversationResponse(
      accountability?.outcome.kind === 'accept_explicit_hard_override'
        ? {
            message: /[çğıöşü]|\b(?:ben|bugün|yarın|kesin)\b/iu.test(input.message)
              ? `Tamam. ${accountability.title} açık kalıyor.${accountability.consequence && !accountability.consequencePreviouslyExplained ? ` Bu seçimin sonucu: ${accountability.consequence}` : ''}`
              : `Understood. ${accountability.title} stays open.${accountability.consequence && !accountability.consequencePreviouslyExplained ? ` Skipping this window means: ${accountability.consequence}` : ''}`,
            nextAction: null,
            tone: 'neutral',
          }
        : interventionSuppressed && materialized.decision.conversationResponse
          ? {
              message: /[çğıöşü]|\b(?:ben|bugün|yarın)\b/iu.test(input.message)
                ? 'Taahhüt açık kalıyor. Uygun bir zaman seçtiğinde yeniden planlayabiliriz.'
                : 'The commitment stays open. We can replan it when you choose a viable window.',
              nextAction: null,
              tone: 'neutral',
            }
          : materialized.decision.conversationResponse,
      finalOutcomes,
    );
    const responseMessageId = finalConversationResponse
      ? deterministicUuid(`brain-response:${request.id}`)
      : null;
    await this.dependencies.repository.updateDecisionExecutionResult({
      ownerId: input.ownerId,
      decisionId,
      executionResult: {
        actionCount: mappedActions.length,
        authorizedCount,
        executedCount,
        verifiedCount,
        deniedCount,
        approvalRequested,
        mappingErrorCount,
        actionProcessingError,
        ownerFeedback: recordedFeedback ?? null,
        accountability: accountability ?? null,
        interventionSuppressed,
        nonExecutableReminderModelIntentCount: serverReminderAction
          ? materialized.decision.proposedActions.length
          : 0,
        nonExecutableReminderIntentEvidence: serverReminderAction
          ? materialized.modelDecision.proposedActions.map((intent) => ({
              actionType: intent.actionType,
              riskClass: intent.riskClass,
            }))
          : [],
        actionTransitions,
        finalConversationResponse,
        dailyUseFinalization: accountability ? 1 : null,
        responseMessageId,
      },
    });

    let finalized = false;
    if (finalConversationResponse && responseMessageId) {
      const persistedResponse = {
        id: responseMessageId,
        ownerId: input.ownerId,
        conversationId: input.conversationId,
        sourceEventId: input.sourceEventId,
        correlationId: input.correlationId,
        occurredAt: input.timestamp,
        channel,
        response: finalConversationResponse,
      };
      const ownerOverride = accountability?.explicitHardOverride
        ? {
            ownerId: input.ownerId,
            conversationId: input.conversationId,
            messageId,
            commitmentId: accountability.commitmentId,
            sourceEventId: input.sourceEventId,
            statement: input.message,
            correlationId: input.correlationId,
            now: input.timestamp,
          }
        : null;
      const challengeCommitmentId =
        accountability &&
        accountability.outcome.challengeLevel !== 'none' &&
        accountability.outcome.kind !== 'ask_one_clarification' &&
        !interventionSuppressed
          ? accountability.commitmentId
          : null;
      if (accountability && this.dependencies.repository.finalizeDailyUseTurn) {
        await this.dependencies.repository.finalizeDailyUseTurn({
          requestId: request.id,
          decisionId,
          response: persistedResponse,
          challengeCommitmentId,
          ownerOverride,
        });
        finalized = true;
      } else {
        await this.dependencies.repository.persistConversationResponse(persistedResponse);
        if (ownerOverride)
          await this.dependencies.repository.recordOwnerAccountabilityOverride?.(ownerOverride);
        if (challengeCommitmentId)
          await this.dependencies.repository.recordAccountabilityChallenge?.({
            ownerId: input.ownerId,
            commitmentId: challengeCommitmentId,
            decisionId,
            correlationId: input.correlationId,
            now: input.timestamp,
          });
      }
    }
    if (!finalized)
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
      conversationResponse: finalConversationResponse,
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
