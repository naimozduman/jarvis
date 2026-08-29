import { createHash } from 'node:crypto';

import { and, desc, eq } from 'drizzle-orm';

import { conversationResponseSchema } from '@jarvis/contracts';
import type {
  BrainDecision,
  BrainEvidence,
  BrainRequest,
  ClarificationRequest,
  ContextManifest,
  ContextRecord,
  ConversationResponse,
  MemoryCandidate,
  ModelRun,
  PlanProposal,
  ReminderProposal,
  Channel,
} from '@jarvis/contracts';

import type { JarvisDatabase } from './client.js';
import {
  brainDecisionEvidence,
  brainDecisions,
  brainRequests,
  contextManifestRecords,
  contextManifests,
  clarificationRequests,
  constitutionProposals,
  memoryCandidates,
  memoryEvidence,
  messages,
  modelRuns,
  planProposals,
  reminderProposals,
} from './schema/index.js';

export interface PersistedBrainDecision {
  readonly id: string;
  readonly ownerId: string;
  readonly brainRequestId: string;
  readonly modelRunId: string | null;
  readonly decision: BrainDecision;
  readonly promptVersion: string;
  readonly contextVersion: string;
  readonly validationState: 'validated' | 'rejected';
  readonly executionResult: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
}

export interface PersistedConversationResponse {
  readonly id: string;
  readonly ownerId: string;
  readonly conversationId: string;
  readonly sourceEventId: string | null;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly channel: Channel;
  readonly response: ConversationResponse;
}

export interface PersistedInboundConversationMessage {
  readonly id: string;
  readonly ownerId: string;
  readonly conversationId: string;
  readonly sourceEventId: string | null;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly content: string;
  readonly channel: Channel;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Narrow durable brain interface. @jarvis/brain consumes this port, never a Drizzle client or a
 * table export. The concrete adapter remains in @jarvis/database to preserve the architecture
 * boundary and owner-scoped querying discipline.
 */
export interface BrainRepository {
  beginOrLoadRequest(request: BrainRequest): Promise<{
    readonly request: BrainRequest;
    readonly duplicate: boolean;
  }>;
  updateRequestState(input: {
    readonly ownerId: string;
    readonly requestId: string;
    readonly state: BrainRequest['state'];
    readonly promptVersion?: string;
    readonly contextVersion?: string;
    readonly safeErrorCategory?: string | null;
    readonly completedAt?: string | null;
  }): Promise<void>;
  persistContextManifest(manifest: ContextManifest): Promise<void>;
  persistModelRun(run: ModelRun): Promise<void>;
  persistDecision(input: PersistedBrainDecision): Promise<void>;
  persistMemoryCandidate(candidate: MemoryCandidate): Promise<void>;
  persistConstitutionCandidate(input: {
    readonly candidate: MemoryCandidate;
    readonly correlationId: string;
  }): Promise<void>;
  persistPlanProposal(input: {
    readonly proposal: PlanProposal;
    readonly sourceBrainDecisionId: string;
    readonly correlationId: string;
  }): Promise<void>;
  persistReminderProposal(input: {
    readonly proposal: ReminderProposal;
    readonly sourceBrainDecisionId: string;
    readonly correlationId: string;
  }): Promise<void>;
  persistClarification(input: {
    readonly ownerId: string;
    readonly brainRequestId: string;
    readonly clarification: ClarificationRequest;
    readonly correlationId: string;
  }): Promise<void>;
  persistInboundMessage(input: PersistedInboundConversationMessage): Promise<void>;
  persistConversationResponse(input: PersistedConversationResponse): Promise<void>;
  /** Rehydrates a previously persisted response after an idempotent worker retry. */
  getConversationResponse(input: {
    readonly ownerId: string;
    readonly responseMessageId: string;
  }): Promise<{ readonly id: string; readonly response: ConversationResponse } | undefined>;
  updateDecisionExecutionResult(input: {
    readonly ownerId: string;
    readonly decisionId: string;
    readonly executionResult: Readonly<Record<string, unknown>>;
  }): Promise<void>;
  getDecisionForRequest(input: {
    readonly ownerId: string;
    readonly requestId: string;
  }): Promise<{ readonly id: string; readonly decisionType: string } | undefined>;
  listContextRecords(input: {
    readonly ownerId: string;
    readonly conversationId: string | null;
    readonly maximumRecentMessages: number;
  }): Promise<readonly ContextRecord[]>;
}

function asRequest(row: typeof brainRequests.$inferSelect): BrainRequest {
  return {
    id: row.id,
    ownerId: row.ownerId,
    conversationId: row.conversationId ?? null,
    sourceEventId: row.sourceEventId ?? null,
    messageId: row.messageId ?? null,
    purpose: row.purpose as BrainRequest['purpose'],
    idempotencyKey: row.idempotencyKey,
    correlationId: row.correlationId,
    causationId: row.causationId ?? null,
    requestedAt: row.createdAt.toISOString(),
    state: row.state as BrainRequest['state'],
  };
}

function safeMessageContextRecord(row: typeof messages.$inferSelect): ContextRecord {
  return {
    recordId: row.id,
    recordType: 'message',
    ownerId: row.ownerId,
    source: row.channel,
    informationState: 'known',
    confidenceBasisPoints: 10_000,
    sensitivity: 'sensitive',
    observedAt: row.occurredAt.toISOString(),
    content: row.content?.trim() || '[Non-text message; content is unavailable.]',
    entityReferences: [],
    constitutionalRelevance: 0,
    activeCommitmentRelevance: 10,
    deadlineProximityMinutes: null,
    currentDayRelevance: 20,
    sourceAuthority: 100,
  };
}

/**
 * Initial Drizzle implementation for the durable brain lifecycle. Context retrieval starts with
 * recent canonical messages; the ContextAssembler combines these with explicit service-provided
 * constitution, memory, commitment, and day-plan sources so the adapter never performs broad,
 * unbounded database-to-model dumping.
 */
export class DrizzleBrainRepository implements BrainRepository {
  public constructor(private readonly database: JarvisDatabase) {}

  public async beginOrLoadRequest(request: BrainRequest): Promise<{
    readonly request: BrainRequest;
    readonly duplicate: boolean;
  }> {
    const [created] = await this.database
      .insert(brainRequests)
      .values({
        id: request.id,
        ownerId: request.ownerId,
        conversationId: request.conversationId ?? undefined,
        sourceEventId: request.sourceEventId ?? undefined,
        messageId: request.messageId ?? undefined,
        purpose: request.purpose,
        state: request.state,
        idempotencyKey: request.idempotencyKey,
        correlationId: request.correlationId,
        causationId: request.causationId ?? undefined,
        createdAt: new Date(request.requestedAt),
        updatedAt: new Date(request.requestedAt),
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      return { request: asRequest(created), duplicate: false };
    }

    const [existing] = await this.database
      .select()
      .from(brainRequests)
      .where(
        and(
          eq(brainRequests.ownerId, request.ownerId),
          eq(brainRequests.idempotencyKey, request.idempotencyKey),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error(
        'The brain request insert conflicted without an owner-scoped existing request.',
      );
    }

    return { request: asRequest(existing), duplicate: true };
  }

  public async updateRequestState(input: {
    readonly ownerId: string;
    readonly requestId: string;
    readonly state: BrainRequest['state'];
    readonly promptVersion?: string;
    readonly contextVersion?: string;
    readonly safeErrorCategory?: string | null;
    readonly completedAt?: string | null;
  }): Promise<void> {
    const [updated] = await this.database
      .update(brainRequests)
      .set({
        state: input.state,
        ...(input.promptVersion === undefined ? {} : { promptVersion: input.promptVersion }),
        ...(input.contextVersion === undefined ? {} : { contextVersion: input.contextVersion }),
        ...(input.safeErrorCategory === undefined
          ? {}
          : { safeErrorCategory: input.safeErrorCategory }),
        ...(input.completedAt === undefined
          ? {}
          : { completedAt: input.completedAt ? new Date(input.completedAt) : null }),
        updatedAt: new Date(),
      })
      .where(and(eq(brainRequests.id, input.requestId), eq(brainRequests.ownerId, input.ownerId)))
      .returning({ id: brainRequests.id });

    if (!updated) {
      throw new Error('A brain request state update targeted a missing or foreign request.');
    }
  }

  public async persistContextManifest(manifest: ContextManifest): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction.insert(contextManifests).values({
        id: manifest.id,
        ownerId: manifest.ownerId,
        brainRequestId: manifest.brainRequestId,
        contextVersion: manifest.contextVersion,
        promptTokenEstimate: manifest.promptTokenEstimate,
        recordLimit: manifest.recordLimit,
        excludedRecordCount: manifest.excludedRecordCount,
        sourceHash: createHash('sha256')
          .update(
            JSON.stringify(
              manifest.selectedRecords.map((record) => ({
                recordId: record.recordId,
                recordType: record.recordType,
                rank: record.rank,
                score: record.score,
                redactedForModel: record.redactedForModel,
              })),
            ),
            'utf8',
          )
          .digest('hex'),
        createdAt: new Date(manifest.createdAt),
        updatedAt: new Date(manifest.createdAt),
      });

      if (manifest.selectedRecords.length > 0) {
        await transaction.insert(contextManifestRecords).values(
          manifest.selectedRecords.map((record) => ({
            ownerId: manifest.ownerId,
            contextManifestId: manifest.id,
            recordType: record.recordType,
            recordId: record.recordId,
            rank: record.rank,
            score: record.score,
            selectionReasons: [...record.selectionReasons],
            sensitivity: record.sensitivity,
            redactedForModel: record.redactedForModel,
            createdAt: new Date(manifest.createdAt),
            updatedAt: new Date(manifest.createdAt),
          })),
        );
      }
    });
  }

  public async persistModelRun(run: ModelRun): Promise<void> {
    await this.database.insert(modelRuns).values({
      id: run.id,
      ownerId: run.ownerId,
      brainRequestId: run.brainRequestId,
      provider:
        run.configuredModelId === 'fake-model'
          ? 'fake'
          : run.status === 'not_configured'
            ? 'not_configured'
            : 'openai',
      route: run.route,
      configuredModelId: run.configuredModelId,
      actualModelId: run.actualModelId ?? undefined,
      reasoningEffort: run.reasoningEffort ?? undefined,
      status: run.status,
      latencyMs: run.latencyMs ?? undefined,
      inputTokens: run.inputTokens ?? undefined,
      outputTokens: run.outputTokens ?? undefined,
      reasoningTokens: run.reasoningTokens ?? undefined,
      cachedInputTokens: run.cachedInputTokens ?? undefined,
      estimatedCostUsd: run.estimatedCostUsd?.toFixed(8),
      errorCategory: run.errorCategory ?? undefined,
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.createdAt),
    });
  }

  public async persistDecision(input: PersistedBrainDecision): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction.insert(brainDecisions).values({
        id: input.id,
        ownerId: input.ownerId,
        brainRequestId: input.brainRequestId,
        modelRunId: input.modelRunId ?? undefined,
        decisionType: input.decision.decisionType,
        decisionSummary: input.decision.reasoningSummary.decisionSummary,
        materialTradeoffs: [...input.decision.reasoningSummary.materialTradeoffs],
        confidenceBasisPoints: input.decision.reasoningSummary.confidenceBasisPoints,
        missingInformation: [...input.decision.reasoningSummary.missingInformation],
        validationState: input.validationState,
        promptVersion: input.promptVersion,
        contextVersion: input.contextVersion,
        executionResult: { ...input.executionResult },
        correlationId: input.correlationId,
      });

      if (input.decision.evidence.length > 0) {
        await transaction.insert(brainDecisionEvidence).values(
          input.decision.evidence.map((evidence: BrainEvidence) => ({
            ownerId: input.ownerId,
            brainDecisionId: input.id,
            recordType: evidence.recordType,
            recordId: evidence.recordId,
            source: evidence.source,
            informationState: evidence.informationState,
            confidenceBasisPoints: evidence.confidenceBasisPoints,
            sensitivity: evidence.sensitivity,
          })),
        );
      }
    });
  }

  public async persistMemoryCandidate(candidate: MemoryCandidate): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction.insert(memoryCandidates).values({
        id: candidate.id,
        ownerId: candidate.ownerId,
        kind: candidate.kind,
        normalizedStatement: candidate.normalizedStatement,
        authority: candidate.authority,
        sourceEventId: candidate.sourceEventId ?? undefined,
        sourceMessageId: candidate.sourceMessageId ?? undefined,
        sourceBrainDecisionId: candidate.sourceDecisionId ?? undefined,
        confidenceBasisPoints: candidate.confidenceBasisPoints,
        sensitivity: candidate.sensitivity,
        validFrom: candidate.validFrom ? new Date(candidate.validFrom) : undefined,
        validTo: candidate.validTo ? new Date(candidate.validTo) : undefined,
        reviewAt: candidate.reviewAt ? new Date(candidate.reviewAt) : undefined,
        relatedEntityIds: [...candidate.relatedEntityIds],
        requiresOwnerConfirmation: candidate.requiresOwnerConfirmation,
        state: candidate.state,
        createdAt: new Date(candidate.createdAt),
        updatedAt: new Date(candidate.updatedAt),
      });
      if (candidate.evidenceIds.length > 0) {
        await transaction.insert(memoryEvidence).values(
          candidate.evidenceIds.map((evidenceRecordId) => ({
            ownerId: candidate.ownerId,
            memoryCandidateId: candidate.id,
            evidenceRecordId,
            evidenceType: 'brain_context_record',
            authority: candidate.authority,
            observedAt: new Date(candidate.createdAt),
            confidenceDeltaBasisPoints: 0,
          })),
        );
      }
    });
  }

  public async persistConstitutionCandidate(input: {
    readonly candidate: MemoryCandidate;
    readonly correlationId: string;
  }): Promise<void> {
    if (input.candidate.kind !== 'constitution_candidate') {
      throw new Error('Only a constitution candidate may create a draft constitution proposal.');
    }
    await this.database.insert(constitutionProposals).values({
      ownerId: input.candidate.ownerId,
      sourceBrainDecisionId: input.candidate.sourceDecisionId ?? undefined,
      category: 'general',
      principle: input.candidate.normalizedStatement,
      priority: 50,
      flexibility: 'negotiable',
      state: 'draft',
      proposedBy: 'brain_candidate',
      correlationId: input.correlationId,
      createdAt: new Date(input.candidate.createdAt),
      updatedAt: new Date(input.candidate.updatedAt),
    });
  }

  public async persistPlanProposal(input: {
    readonly proposal: PlanProposal;
    readonly sourceBrainDecisionId: string;
    readonly correlationId: string;
  }): Promise<void> {
    await this.database.insert(planProposals).values({
      id: input.proposal.id,
      ownerId: input.proposal.ownerId,
      dayPlanId: input.proposal.dayPlanId,
      sourceBrainDecisionId: input.sourceBrainDecisionId,
      trigger: input.proposal.trigger,
      state: input.proposal.valid ? 'validated' : 'rejected',
      proposal: { ...input.proposal },
      validationErrors: [...input.proposal.validationErrors],
      validatedAt: new Date(input.proposal.createdAt),
      correlationId: input.correlationId,
      createdAt: new Date(input.proposal.createdAt),
      updatedAt: new Date(input.proposal.createdAt),
    });
  }

  public async persistReminderProposal(input: {
    readonly proposal: ReminderProposal;
    readonly sourceBrainDecisionId: string;
    readonly correlationId: string;
  }): Promise<void> {
    await this.database.insert(reminderProposals).values({
      id: input.proposal.id,
      ownerId: input.proposal.ownerId,
      // A proposal is not yet a durable reminder. The allowed action pipeline creates one later.
      reminderId: undefined,
      commitmentId: input.proposal.commitmentId ?? undefined,
      sourceBrainDecisionId: input.sourceBrainDecisionId,
      kind: input.proposal.kind,
      critical: input.proposal.critical,
      state: 'proposed',
      scheduledFor: input.proposal.scheduledFor ? new Date(input.proposal.scheduledFor) : undefined,
      rationale: input.proposal.rationale,
      correlationId: input.correlationId,
    });
  }

  public async persistClarification(input: {
    readonly ownerId: string;
    readonly brainRequestId: string;
    readonly clarification: ClarificationRequest;
    readonly correlationId: string;
  }): Promise<void> {
    await this.database.insert(clarificationRequests).values({
      ownerId: input.ownerId,
      brainRequestId: input.brainRequestId,
      question: input.clarification.question,
      reason: input.clarification.reason,
      state: 'open',
      askedAt: new Date(),
      correlationId: input.correlationId,
    });
  }

  public async persistInboundMessage(input: PersistedInboundConversationMessage): Promise<void> {
    await this.database
      .insert(messages)
      .values({
        id: input.id,
        ownerId: input.ownerId,
        conversationId: input.conversationId,
        channel: input.channel,
        direction: 'inbound',
        contentType: 'text/plain',
        content: input.content,
        deliveryState: 'local_persisted',
        occurredAt: new Date(input.occurredAt),
        receivedAt: new Date(input.occurredAt),
        correlationId: input.correlationId,
        sourceEventId: input.sourceEventId ?? undefined,
        metadata: { ...input.metadata },
      })
      .onConflictDoNothing();
  }

  public async persistConversationResponse(input: PersistedConversationResponse): Promise<void> {
    await this.database.insert(messages).values({
      id: input.id,
      ownerId: input.ownerId,
      conversationId: input.conversationId,
      channel: input.channel,
      direction: 'outbound',
      contentType: 'text/plain',
      content: input.response.message,
      deliveryState: 'local_persisted',
      occurredAt: new Date(input.occurredAt),
      receivedAt: new Date(input.occurredAt),
      correlationId: input.correlationId,
      sourceEventId: input.sourceEventId ?? undefined,
      metadata: {
        nextAction: input.response.nextAction,
        tone: input.response.tone,
      },
    });
  }

  public async getConversationResponse(input: {
    readonly ownerId: string;
    readonly responseMessageId: string;
  }): Promise<{ readonly id: string; readonly response: ConversationResponse } | undefined> {
    const [message] = await this.database
      .select({ id: messages.id, content: messages.content, metadata: messages.metadata })
      .from(messages)
      .where(and(eq(messages.id, input.responseMessageId), eq(messages.ownerId, input.ownerId)))
      .limit(1);
    if (!message?.content) {
      return undefined;
    }
    const response = conversationResponseSchema.safeParse({
      message: message.content,
      nextAction: message.metadata['nextAction'] ?? null,
      tone: message.metadata['tone'],
    });
    if (!response.success) {
      throw new Error('A persisted conversation response failed canonical schema validation.');
    }
    return { id: message.id, response: response.data };
  }

  public async updateDecisionExecutionResult(input: {
    readonly ownerId: string;
    readonly decisionId: string;
    readonly executionResult: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    const [updated] = await this.database
      .update(brainDecisions)
      .set({ executionResult: { ...input.executionResult }, updatedAt: new Date() })
      .where(
        and(eq(brainDecisions.id, input.decisionId), eq(brainDecisions.ownerId, input.ownerId)),
      )
      .returning({ id: brainDecisions.id });
    if (!updated) {
      throw new Error('A decision execution update targeted a missing or foreign brain decision.');
    }
  }

  public async getDecisionForRequest(input: {
    readonly ownerId: string;
    readonly requestId: string;
  }): Promise<{ readonly id: string; readonly decisionType: string } | undefined> {
    const [decision] = await this.database
      .select({ id: brainDecisions.id, decisionType: brainDecisions.decisionType })
      .from(brainDecisions)
      .where(
        and(
          eq(brainDecisions.ownerId, input.ownerId),
          eq(brainDecisions.brainRequestId, input.requestId),
        ),
      )
      .limit(1);
    return decision;
  }

  public async listContextRecords(input: {
    readonly ownerId: string;
    readonly conversationId: string | null;
    readonly maximumRecentMessages: number;
  }): Promise<readonly ContextRecord[]> {
    if (!input.conversationId || input.maximumRecentMessages === 0) {
      return [];
    }

    const recent = await this.database
      .select()
      .from(messages)
      .where(
        and(eq(messages.ownerId, input.ownerId), eq(messages.conversationId, input.conversationId)),
      )
      .orderBy(desc(messages.occurredAt))
      .limit(input.maximumRecentMessages);

    return recent.reverse().map(safeMessageContextRecord);
  }
}
