import { createHash } from 'node:crypto';

import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';

import {
  conversationResponseSchema,
  isModelAccountingSafe,
  isOwnerBaselineCapture,
} from '@jarvis/contracts';
import type {
  BrainDecision,
  PlanningCommitment,
  BrainEvidence,
  BrainRequest,
  ClarificationRequest,
  ContextManifest,
  ContextRecord,
  ConversationResponse,
  MemoryCandidate,
  ModelRun,
  ModelRequestAdmission,
  PlanProposal,
  ReminderProposal,
  Channel,
  RecordedOwnerFeedback,
  OwnerBaselineReview,
} from '@jarvis/contracts';

import type { JarvisDatabase } from './client.js';
import { loadRequestedReminderTarget } from './requested-reminder-target.js';
import {
  recordOwnerFeedback,
  recordOwnerAccountabilityOverride,
  type RecordOwnerFeedbackInput,
  type RecordOwnerAccountabilityOverrideInput,
} from './owner-feedback.js';
import { loadDailyUseState, type DailyUseState } from './daily-use-context.js';
import {
  loadOwnerBaselineReview,
  finalizeOwnerBaselineTurn,
  type FinalizeOwnerBaselineInput,
} from './owner-baseline.js';
import {
  commitments,
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
  planBlocks,
  reminderProposals,
  owners,
  reminders,
  jobs,
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

export interface FinalizeDailyUseTurnInput {
  readonly requestId: string;
  readonly decisionId: string;
  readonly response: PersistedConversationResponse;
  readonly challengeCommitmentId: string | null;
  readonly ownerOverride: RecordOwnerAccountabilityOverrideInput | null;
}

/**
 * Narrow durable brain interface. @jarvis/brain consumes this port, never a Drizzle client or a
 * table export. The concrete adapter remains in @jarvis/database to preserve the architecture
 * boundary and owner-scoped querying discipline.
 */
export interface BrainRepository {
  loadOwnerBaselineReview?(input: {
    ownerId: string;
    conversationId: string;
    now: string;
  }): Promise<OwnerBaselineReview | null>;
  finalizeOwnerBaselineTurn?(input: FinalizeOwnerBaselineInput): Promise<ConversationResponse>;
  recoverOwnerBaselineTurn?(input: {
    ownerId: string;
    requestId: string;
    responseMessageId: string;
  }): Promise<boolean>;
  finalizeDailyUseTurn?(input: FinalizeDailyUseTurnInput): Promise<void>;
  recoverDailyUseTurn?(input: {
    readonly ownerId: string;
    readonly requestId: string;
    readonly responseMessageId: string;
  }): Promise<boolean>;
  recordOwnerFeedback?(input: RecordOwnerFeedbackInput): Promise<RecordedOwnerFeedback>;
  recordOwnerAccountabilityOverride?(input: RecordOwnerAccountabilityOverrideInput): Promise<void>;
  loadDailyUseState?(input: {
    readonly ownerId: string;
    readonly now: string;
    readonly ownerMessage?: string;
  }): Promise<DailyUseState>;
  recordAccountabilityChallenge?(input: {
    readonly ownerId: string;
    readonly commitmentId: string;
    readonly decisionId: string;
    readonly correlationId: string;
    readonly now: string;
  }): Promise<void>;
  canScheduleOwnerReminder?(input: {
    readonly ownerId: string;
    readonly sourceEventId: string | null;
  }): Promise<boolean>;
  loadOwnerTimezone?(input: { readonly ownerId: string }): Promise<string | null>;
  verifyScheduledReminder?(input: {
    readonly ownerId: string;
    readonly proposal: ReminderProposal;
  }): Promise<boolean>;
  loadOwnerChatRoutingSafety?(input: {
    readonly ownerId: string;
  }): Promise<{ readonly hasConflict: boolean; readonly materialUncertainty: boolean }>;
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
    readonly admission?: ModelRequestAdmission;
  }): Promise<void>;
  loadPlanningCommitments?(input: {
    readonly ownerId: string;
    readonly commitmentIds: readonly string[];
  }): Promise<readonly PlanningCommitment[]>;
  persistContextManifest(manifest: ContextManifest): Promise<void>;
  persistModelRun(run: ModelRun): Promise<void>;
  loadModelAccountingSafety?(input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly admission?: ModelRequestAdmission;
  }): Promise<boolean>;
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
  /** Re-reads canonical state after execution before success wording is persisted. */
  verifyAppliedPlanOperation?(input: {
    readonly ownerId: string;
    readonly proposal: PlanProposal;
  }): Promise<boolean>;
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
    content:
      row.metadata.ownerBaselineEvidenceExcluded === true ||
      isOwnerBaselineCapture(row.content ?? '')
        ? '[Owner baseline source/review omitted from general history; use approved scoped canonical records.]'
        : `${row.direction === 'inbound' ? 'Owner' : 'JARVIS'}: ${row.content?.trim() || '[Non-text message; content is unavailable.]'}`,
    entityReferences: [],
    constitutionalRelevance: 0,
    activeCommitmentRelevance: 10,
    deadlineProximityMinutes: null,
    currentDayRelevance: 20,
    sourceAuthority: 100,
  };
}

/**
 * `model_runs.estimated_cost_usd` has eight fractional decimal places. Preserve the safety guard
 * by rounding a provider receipt upward at that storage boundary; rounding to nearest could make
 * a series of very small Gateway charges look cheaper than Vercel reported.
 */
function conservativeReportedCostUsd(value: number | null): string | undefined {
  if (value === null) return undefined;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('A model cost receipt must be a finite non-negative number.');
  }
  return (Math.ceil(value * 100_000_000) / 100_000_000).toFixed(8);
}

/**
 * Initial Drizzle implementation for the durable brain lifecycle. Context retrieval starts with
 * recent canonical messages; the ContextAssembler combines these with explicit service-provided
 * constitution, memory, commitment, and day-plan sources so the adapter never performs broad,
 * unbounded database-to-model dumping.
 */
export class DrizzleBrainRepository implements BrainRepository {
  public async loadOwnerBaselineReview(input: {
    ownerId: string;
    conversationId: string;
    now: string;
  }): Promise<OwnerBaselineReview | null> {
    return loadOwnerBaselineReview(this.database, input);
  }
  public async finalizeOwnerBaselineTurn(
    input: FinalizeOwnerBaselineInput,
  ): Promise<ConversationResponse> {
    return finalizeOwnerBaselineTurn(this.database, input);
  }
  public async recoverOwnerBaselineTurn(input: {
    ownerId: string;
    requestId: string;
    responseMessageId: string;
  }): Promise<boolean> {
    const [decision] = await this.database
      .select({ id: brainDecisions.id, result: brainDecisions.executionResult })
      .from(brainDecisions)
      .where(
        and(
          eq(brainDecisions.ownerId, input.ownerId),
          eq(brainDecisions.brainRequestId, input.requestId),
        ),
      )
      .limit(1);
    if (decision?.result.ownerBaselineFinalization !== 1) return false;
    await this.finalizeOwnerBaselineTurn({ ...input, decisionId: decision.id });
    return true;
  }
  public async finalizeDailyUseTurn(input: FinalizeDailyUseTurnInput): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`select id from jarvis.brain_requests
        where id = ${input.requestId}::uuid and owner_id = ${input.response.ownerId}::uuid for update`);
      if (!locked.rows[0])
        throw new Error('Daily-use finalization requires an owned canonical request.');
      // The transaction exposes the same query API; all nested writes remain on this connection.
      const repository = new DrizzleBrainRepository(transaction as unknown as JarvisDatabase);
      const existing = await repository.getConversationResponse({
        ownerId: input.response.ownerId,
        responseMessageId: input.response.id,
      });
      if (!existing) await repository.persistConversationResponse(input.response);
      else if (JSON.stringify(existing.response) !== JSON.stringify(input.response.response))
        throw new Error('A finalized response cannot be rebound.');
      if (input.challengeCommitmentId)
        await repository.recordAccountabilityChallenge({
          ownerId: input.response.ownerId,
          commitmentId: input.challengeCommitmentId,
          decisionId: input.decisionId,
          correlationId: input.response.correlationId,
          now: input.response.occurredAt,
        });
      if (input.ownerOverride)
        await repository.recordOwnerAccountabilityOverride(input.ownerOverride);
      await repository.updateRequestState({
        ownerId: input.response.ownerId,
        requestId: input.requestId,
        state: 'completed',
        completedAt: input.response.occurredAt,
      });
    });
  }
  public async recoverDailyUseTurn(input: {
    ownerId: string;
    requestId: string;
    responseMessageId: string;
  }): Promise<boolean> {
    const [row] = await this.database
      .select({ request: brainRequests, decision: brainDecisions, message: messages })
      .from(brainRequests)
      .innerJoin(
        brainDecisions,
        and(
          eq(brainDecisions.brainRequestId, brainRequests.id),
          eq(brainDecisions.ownerId, brainRequests.ownerId),
        ),
      )
      .innerJoin(
        messages,
        and(
          eq(messages.id, brainRequests.messageId),
          eq(messages.ownerId, brainRequests.ownerId),
          eq(messages.direction, 'inbound'),
        ),
      )
      .where(and(eq(brainRequests.id, input.requestId), eq(brainRequests.ownerId, input.ownerId)))
      .limit(1);
    if (
      !row ||
      row.decision.executionResult.dailyUseFinalization !== 1 ||
      row.decision.executionResult.responseMessageId !== input.responseMessageId ||
      !row.request.conversationId
    )
      return false;
    const response = conversationResponseSchema.safeParse(
      row.decision.executionResult.finalConversationResponse,
    );
    if (!response.success) return false;
    const value = row.decision.executionResult.accountability;
    const accountability =
      typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
    const result = accountability?.outcome;
    const outcome =
      typeof result === 'object' && result !== null ? (result as Record<string, unknown>) : null;
    const commitmentId =
      typeof accountability?.commitmentId === 'string' ? accountability.commitmentId : null;
    const challengeCommitmentId =
      commitmentId &&
      outcome &&
      (outcome.challengeLevel === 'gentle' || outcome.challengeLevel === 'direct') &&
      outcome?.kind !== 'ask_one_clarification' &&
      row.decision.executionResult.interventionSuppressed !== true
        ? commitmentId
        : null;
    await this.finalizeDailyUseTurn({
      requestId: input.requestId,
      decisionId: row.decision.id,
      response: {
        id: input.responseMessageId,
        ownerId: input.ownerId,
        conversationId: row.request.conversationId,
        sourceEventId: row.request.sourceEventId ?? null,
        correlationId: row.request.correlationId,
        occurredAt: row.request.createdAt.toISOString(),
        channel: row.message.channel,
        response: response.data,
      },
      challengeCommitmentId,
      ownerOverride:
        commitmentId && accountability?.explicitHardOverride === true
          ? {
              ownerId: input.ownerId,
              conversationId: row.request.conversationId,
              messageId: row.message.id,
              commitmentId,
              sourceEventId: row.request.sourceEventId ?? null,
              statement: row.message.content ?? '',
              correlationId: row.request.correlationId,
              now: row.request.createdAt.toISOString(),
            }
          : null,
    });
    return true;
  }
  public async recordOwnerFeedback(
    input: RecordOwnerFeedbackInput,
  ): Promise<RecordedOwnerFeedback> {
    return recordOwnerFeedback(this.database, input);
  }
  public async recordOwnerAccountabilityOverride(
    input: RecordOwnerAccountabilityOverrideInput,
  ): Promise<void> {
    return recordOwnerAccountabilityOverride(this.database, input);
  }
  public async loadDailyUseState(input: {
    ownerId: string;
    now: string;
    ownerMessage?: string;
  }): Promise<DailyUseState> {
    return loadDailyUseState(this.database, input);
  }
  public async recordAccountabilityChallenge(input: {
    ownerId: string;
    commitmentId: string;
    decisionId: string;
    correlationId: string;
    now: string;
  }): Promise<void> {
    const [target] = await this.database
      .select({ id: commitments.id })
      .from(commitments)
      .where(and(eq(commitments.id, input.commitmentId), eq(commitments.ownerId, input.ownerId)))
      .limit(1);
    if (!target) throw new Error('Challenge evidence requires an owned canonical commitment.');
    const hex = createHash('sha256')
      .update(`challenge:${input.ownerId}:${input.decisionId}:${input.commitmentId}`)
      .digest('hex');
    const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    await this.database
      .execute(sql`insert into jarvis.audit_events (id, owner_id, actor_type, action, target_type, target_id, occurred_at, correlation_id, source, metadata)
      values (${id}::uuid, ${input.ownerId}::uuid, 'system', 'accountability.challenge.prepared', 'commitment', ${input.commitmentId}::uuid,
        ${new Date(input.now)}, ${input.correlationId}::uuid, 'conversation_turn', ${JSON.stringify({ decisionId: input.decisionId, authorityChanged: false })}::jsonb) on conflict (id) do nothing`);
  }
  public async canScheduleOwnerReminder(input: {
    readonly ownerId: string;
    readonly sourceEventId: string | null;
  }): Promise<boolean> {
    if (!input.sourceEventId) return false;
    const target = await loadRequestedReminderTarget(
      this.database,
      input.ownerId,
      input.sourceEventId,
    );
    return Boolean(
      target?.connection.outboundEnabled &&
      target.connection.versionVerified &&
      target.connection.state === 'connected',
    );
  }
  public async loadOwnerTimezone(input: { readonly ownerId: string }): Promise<string | null> {
    const [owner] = await this.database
      .select({ timezone: owners.timezone })
      .from(owners)
      .where(eq(owners.id, input.ownerId))
      .limit(1);
    return owner?.timezone ?? null;
  }
  public async verifyScheduledReminder(input: {
    readonly ownerId: string;
    readonly proposal: ReminderProposal;
  }): Promise<boolean> {
    const [row] = await this.database
      .select({
        title: reminders.title,
        due: reminders.nextEligibleDeliveryAt,
        jobId: reminders.jobId,
        state: reminders.state,
        jobType: jobs.jobType,
        scheduledFor: jobs.scheduledFor,
        availableAfter: jobs.availableAfter,
        jobState: jobs.status,
        jobPayload: jobs.payload,
      })
      .from(reminders)
      .innerJoin(jobs, and(eq(jobs.id, reminders.jobId), eq(jobs.ownerId, reminders.ownerId)))
      .innerJoin(
        reminderProposals,
        and(
          eq(reminderProposals.id, reminders.id),
          eq(reminderProposals.reminderId, reminders.id),
          eq(reminderProposals.ownerId, reminders.ownerId),
          eq(reminderProposals.state, 'applied'),
        ),
      )
      .where(and(eq(reminders.id, input.proposal.id), eq(reminders.ownerId, input.ownerId)))
      .limit(1);
    return Boolean(
      row &&
      row.title === input.proposal.title &&
      row.state === 'active' &&
      row.jobType === 'jarvis.reminder.fire' &&
      row.jobState === 'queued' &&
      row.jobPayload.ownerId === input.ownerId &&
      row.jobPayload.reminderId === input.proposal.id &&
      row.availableAfter.toISOString() === input.proposal.scheduledFor &&
      row.due?.toISOString() === input.proposal.scheduledFor &&
      row.scheduledFor.toISOString() === input.proposal.scheduledFor,
    );
  }
  public constructor(private readonly database: JarvisDatabase) {}

  public async loadOwnerChatRoutingSafety(input: {
    readonly ownerId: string;
  }): Promise<{ readonly hasConflict: boolean; readonly materialUncertainty: boolean }> {
    // Owner-scoped booleans only: no private content or authority enters the router.
    const result = await this.database.execute(sql`
      select exists(select 1 from jarvis.source_conflicts where owner_id = ${input.ownerId}::uuid and state = 'open') as has_conflict,
             (exists(select 1 from jarvis.clarification_requests where owner_id = ${input.ownerId}::uuid and state = 'open')
              or exists(select 1 from jarvis.approval_requests where owner_id = ${input.ownerId}::uuid and state = 'pending')) as material_uncertainty
    `);
    const flags = result.rows[0];
    if (
      !flags ||
      typeof flags.has_conflict !== 'boolean' ||
      typeof flags.material_uncertainty !== 'boolean'
    )
      throw new Error('Routing safety unavailable');
    return { hasConflict: flags.has_conflict, materialUncertainty: flags.material_uncertainty };
  }

  public async loadPlanningCommitments(input: {
    readonly ownerId: string;
    readonly commitmentIds: readonly string[];
  }): Promise<readonly PlanningCommitment[]> {
    if (input.commitmentIds.length === 0) return [];
    return this.database
      .select({
        id: commitments.id,
        ownerId: commitments.ownerId,
        title: commitments.title,
        priority: commitments.priority,
        status: commitments.status,
        flexibility: commitments.flexibility,
        source: commitments.source,
      })
      .from(commitments)
      .where(
        and(
          eq(commitments.ownerId, input.ownerId),
          inArray(commitments.id, [...input.commitmentIds]),
        ),
      );
  }

  public async verifyAppliedPlanOperation(input: {
    readonly ownerId: string;
    readonly proposal: PlanProposal;
  }): Promise<boolean> {
    const proposal = input.proposal;
    if (
      !proposal.valid ||
      proposal.contractVersion !== 'flexible_delta_v2' ||
      !proposal.commitmentSchedules?.length
    ) {
      return false;
    }

    const [stored] = await this.database
      .select({ state: planProposals.state })
      .from(planProposals)
      .where(
        and(
          eq(planProposals.id, proposal.id),
          eq(planProposals.ownerId, input.ownerId),
          eq(planProposals.dayPlanId, proposal.dayPlanId),
        ),
      )
      .limit(1);
    if (stored?.state !== 'applied') return false;

    const expected = proposal.commitmentSchedules.map((binding) => ({
      binding,
      block: proposal.proposedBlocks.find((block) => block.id === binding.blockId),
    }));
    if (expected.some((item) => !item.block)) return false;

    const canonical = await this.database
      .select({
        id: planBlocks.id,
        commitmentId: planBlocks.commitmentId,
        title: planBlocks.title,
        role: planBlocks.role,
        anchorClass: planBlocks.anchorClass,
        priority: planBlocks.priority,
        completionState: planBlocks.completionState,
        startAt: planBlocks.startAt,
        endAt: planBlocks.endAt,
      })
      .from(planBlocks)
      .where(
        and(
          eq(planBlocks.ownerId, input.ownerId),
          eq(planBlocks.dayPlanId, proposal.dayPlanId),
          inArray(
            planBlocks.id,
            expected.map((item) => item.binding.blockId),
          ),
        ),
      );
    if (canonical.length !== expected.length) return false;

    return expected.every(({ binding, block }) => {
      const found = canonical.find((candidate) => candidate.id === binding.blockId);
      return (
        Boolean(block) &&
        found?.commitmentId === binding.commitmentId &&
        found.title === block!.title &&
        found.role === block!.role &&
        found.anchorClass === block!.anchorClass &&
        found.priority === block!.priority &&
        found.completionState === block!.completionState &&
        found.startAt?.toISOString() === block!.startAt &&
        found.endAt?.toISOString() === block!.endAt
      );
    });
  }

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
    readonly admission?: ModelRequestAdmission;
  }): Promise<void> {
    const [updated] = await this.database
      .update(brainRequests)
      .set({
        state: input.state,
        ...(input.admission === undefined ? {} : { admission: input.admission }),
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
      provider: run.provider,
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
      estimatedCostUsd: conservativeReportedCostUsd(run.estimatedCostUsd),
      admission: run.admission,
      usageAccounting: run.usageAccounting,
      outputAudit: run.outputAudit,
      exactGatewayCostUsd:
        run.provider === 'vercel-ai-gateway' && run.estimatedCostUsd !== null
          ? String(run.estimatedCostUsd)
          : undefined,
      errorCategory: run.errorCategory ?? undefined,
      createdAt: new Date(run.createdAt),
      updatedAt: new Date(run.createdAt),
    });
  }

  /** An observed cap violation invalidates this owner's model accounting profile until reviewed. */
  public async loadModelAccountingSafety(input: {
    readonly ownerId: string;
    readonly modelId: string;
    readonly admission?: ModelRequestAdmission;
  }): Promise<boolean> {
    const rows = await this.database
      .select({
        accounting: modelRuns.usageAccounting,
        admission: modelRuns.admission,
        inputTokens: modelRuns.inputTokens,
        status: modelRuns.status,
        errorCategory: modelRuns.errorCategory,
      })
      .from(modelRuns)
      .where(
        and(eq(modelRuns.ownerId, input.ownerId), eq(modelRuns.configuredModelId, input.modelId)),
      );
    return rows.every(({ accounting, admission, inputTokens, status, errorCategory }) => {
      // Runs written before request admission and usage accounting existed are historical evidence,
      // not an unclassified result of the current accounting contract. A completed legacy run has
      // already reached a terminal provider result but cannot prove or disprove a bound that was
      // not recorded at the time. Preserve it for audit while allowing a verified current profile
      // to start operating. This exception is deliberately narrow: failed, unavailable, and any
      // row carrying either modern admission or accounting evidence still follows the fail-closed
      // path below.
      if (status === 'completed' && admission == null && accounting == null) return true;
      // Known pre-dispatch failures have no provider observation to invalidate. Unknown
      // network/execution failures remain blocked; absence of usage never proves no dispatch.
      if (
        inputTokens === null &&
        (status === 'not_configured' ||
          admission?.allowed === false ||
          errorCategory === 'admission_mismatch')
      )
        return true;
      return isModelAccountingSafe(
        accounting ?? undefined,
        admission,
        input.admission,
        inputTokens,
      );
    });
  }

  /**
   * Returns only exact Gateway receipts after an operator's Vercel dashboard snapshot. A completed
   * Gateway invocation without a receipt is intentionally observable as unknown, which causes the
   * application-side Free Tier guard to stop before another inference request.
   */
  public async loadZeroCostCreditAccounting(input: {
    readonly ownerId: string;
    readonly afterExclusive: string;
  }): Promise<{
    readonly reportedCostUsdSinceSnapshot: number;
    readonly hasUnknownCompletedCost: boolean;
  }> {
    const afterExclusive = new Date(input.afterExclusive);
    if (Number.isNaN(afterExclusive.getTime())) {
      throw new Error('A Free Tier credit accounting snapshot timestamp is invalid.');
    }
    const rows = await this.database
      .select({
        estimatedCostUsd: modelRuns.estimatedCostUsd,
        inputTokens: modelRuns.inputTokens,
        admission: modelRuns.admission,
        status: modelRuns.status,
      })
      .from(modelRuns)
      .where(
        and(
          eq(modelRuns.ownerId, input.ownerId),
          eq(modelRuns.provider, 'vercel-ai-gateway'),
          gt(modelRuns.createdAt, afterExclusive),
        ),
      );
    let reportedCostUsdSinceSnapshot = 0;
    let hasUnknownCompletedCost = false;
    for (const row of rows) {
      // Admission denial is not an invocation. Every dispatched outcome, including truncation
      // and malformed output, remains billable and belongs in the credit ledger.
      if (row.admission?.allowed === false && row.inputTokens === null) continue;
      if (row.status === 'not_configured' && row.inputTokens === null) continue;
      const cost = row.estimatedCostUsd === null ? Number.NaN : Number(row.estimatedCostUsd);
      if (!Number.isFinite(cost) || cost < 0) {
        hasUnknownCompletedCost = true;
        continue;
      }
      reportedCostUsdSinceSnapshot += cost;
    }
    return { reportedCostUsdSinceSnapshot, hasUnknownCompletedCost };
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
      .select({
        message: messages,
        baselineEvidence: sql<boolean>`exists(select 1 from jarvis.brain_requests r join jarvis.brain_decisions d on d.brain_request_id = r.id and d.owner_id = r.owner_id where r.owner_id = jarvis.messages.owner_id and r.conversation_id = jarvis.messages.conversation_id and d.execution_result->>'ownerBaselineFinalization' = '1' and (jarvis.messages.id = r.message_id or jarvis.messages.id::text = d.execution_result->>'responseMessageId'))`,
        // Scope follows canonical selections into both the owner question and its reply. The
        // retained memory/version metadata also protects history after later corrections.
        scopedBaselineEvidence: sql<boolean>`exists(
          select 1 from jarvis.brain_requests r
          join jarvis.context_manifests m on m.brain_request_id = r.id and m.owner_id = r.owner_id
          join jarvis.context_manifest_records cr on cr.context_manifest_id = m.id and cr.owner_id = r.owner_id
          where r.owner_id = jarvis.messages.owner_id and r.conversation_id = jarvis.messages.conversation_id
          and (jarvis.messages.id = r.message_id or (jarvis.messages.direction = 'outbound' and jarvis.messages.correlation_id = r.correlation_id))
          and (
            exists(select 1 from jarvis.memory_records mr where mr.owner_id = r.owner_id and (mr.id = cr.record_id or mr.related_entity_ids @> jsonb_build_array(cr.record_id::text)) and mr.metadata->>'personalContextScope' = 'named_owner_request_only')
            or exists(select 1 from jarvis.commitments c where c.owner_id = r.owner_id and c.id = cr.record_id and c.metadata->>'personalContextScope' = 'named_owner_request_only')
            or exists(select 1 from jarvis.constitution_item_versions v where v.owner_id = r.owner_id and v.constitution_item_id = cr.record_id and exists(select 1 from jsonb_array_elements(v.exceptions) e where e->>'personalContextName' is not null))
          ))`,
      })
      .from(messages)
      .where(
        and(eq(messages.ownerId, input.ownerId), eq(messages.conversationId, input.conversationId)),
      )
      .orderBy(desc(messages.occurredAt))
      .limit(input.maximumRecentMessages);

    return recent.reverse().map((row) =>
      safeMessageContextRecord({
        ...row.message,
        metadata: {
          ...row.message.metadata,
          ownerBaselineEvidenceExcluded: row.baselineEvidence || row.scopedBaselineEvidence,
        },
      }),
    );
  }
}
