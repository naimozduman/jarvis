import { createHash, randomUUID } from 'node:crypto';

import { and, eq, or } from 'drizzle-orm';
import { canonicalJson, utcTimestampSchema, uuidSchema } from '@jarvis/contracts';
import type {
  ApprovalRequest,
  AuditEventInput,
  CanonicalEvent,
  DurableJobInput,
  EventProcessingStatus,
  IncomingEventEnvelope,
  PolicyEvaluation,
  ProposedAction,
} from '@jarvis/contracts';
import type {
  EventPersistenceResult,
  EventTransaction,
  InternalActionExecutionResult,
  TransactionalEventStore,
} from '@jarvis/domain';
import { createSafeAuditEvent } from '@jarvis/security';

import type { JarvisDatabase } from './client.js';
import type { TransactionalJobTransport } from './jobs.js';
import {
  actionExecutions,
  actionResults,
  approvalRequests,
  auditEvents,
  commitmentStatusHistory,
  commitments,
  events,
  jobs,
  policyEvaluations,
  proposedActions,
  reminders,
} from './schema/index.js';

type TransactionCallback = Parameters<JarvisDatabase['transaction']>[0];
type DatabaseTransaction = Parameters<TransactionCallback>[0];

function payloadHash(payload: Readonly<Record<string, unknown>>): string {
  return createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex');
}

function requiredString(payload: Readonly<Record<string, unknown>>, field: string): string {
  const value = payload[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`validation: ${field} is required for this internal action.`);
  }

  return value;
}

function requiredUuid(payload: Readonly<Record<string, unknown>>, field: string): string {
  const value = requiredString(payload, field);
  if (!uuidSchema.safeParse(value).success) {
    throw new Error(`validation: ${field} must be a UUID.`);
  }

  return value;
}

function requiredTimestamp(payload: Readonly<Record<string, unknown>>, field: string): Date {
  const value = requiredString(payload, field);
  if (!utcTimestampSchema.safeParse(value).success) {
    throw new Error(`validation: ${field} must be an ISO 8601 UTC timestamp.`);
  }

  return new Date(value);
}

function asCanonicalEvent(row: typeof events.$inferSelect): CanonicalEvent {
  return {
    id: row.id,
    ownerId: row.ownerId,
    eventType: row.eventType,
    source: row.source,
    sourceEventId: row.sourceEventId ?? undefined,
    idempotencyKey: row.idempotencyKey,
    occurredAt: row.occurredAt.toISOString(),
    receivedAt: row.receivedAt.toISOString(),
    payload: row.payload,
    schemaVersion: row.schemaVersion,
    processingStatus: row.processingStatus,
    correlationId: row.correlationId,
    causationId: row.causationId ?? undefined,
  };
}

function asProposedAction(row: typeof proposedActions.$inferSelect): ProposedAction {
  return {
    id: row.id,
    ownerId: row.ownerId,
    actionType: row.actionType,
    payload: row.payload,
    riskClass: row.riskClass,
    idempotencyKey: row.idempotencyKey,
    sourceEventId: row.sourceEventId ?? undefined,
    sourceDecisionId: row.sourceDecisionId ?? undefined,
    correlationId: row.correlationId,
    causationId: row.causationId ?? undefined,
    state: row.state,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

class DrizzleEventTransaction implements EventTransaction {
  public constructor(
    private readonly transaction: DatabaseTransaction,
    private readonly jobTransport: TransactionalJobTransport,
  ) {}

  public async persistEvent(input: {
    readonly ownerId: string;
    readonly envelope: IncomingEventEnvelope;
    readonly receivedAt: string;
    readonly correlationId: string;
  }): Promise<EventPersistenceResult> {
    const [created] = await this.transaction
      .insert(events)
      .values({
        ownerId: input.ownerId,
        eventType: input.envelope.eventType,
        source: input.envelope.source,
        sourceEventId: input.envelope.sourceEventId,
        idempotencyKey: input.envelope.idempotencyKey,
        occurredAt: new Date(input.envelope.occurredAt),
        receivedAt: new Date(input.receivedAt),
        payload: input.envelope.payload,
        payloadHash: payloadHash(input.envelope.payload),
        schemaVersion: input.envelope.schemaVersion,
        processingStatus: 'queued',
        correlationId: input.envelope.correlationId ?? input.correlationId,
        causationId: input.envelope.causationId,
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      return { event: asCanonicalEvent(created), duplicate: false };
    }

    const eventByIdempotency = and(
      eq(events.ownerId, input.ownerId),
      eq(events.idempotencyKey, input.envelope.idempotencyKey),
    );
    const eventBySource = input.envelope.sourceEventId
      ? and(
          eq(events.ownerId, input.ownerId),
          eq(events.source, input.envelope.source),
          eq(events.eventType, input.envelope.eventType),
          eq(events.sourceEventId, input.envelope.sourceEventId),
        )
      : undefined;
    const [existing] = await this.transaction
      .select()
      .from(events)
      .where(eventBySource ? or(eventByIdempotency, eventBySource) : eventByIdempotency)
      .limit(1);

    if (!existing) {
      throw new Error('The event insert conflicted but no canonical event could be found.');
    }

    return { event: asCanonicalEvent(existing), duplicate: true };
  }

  public async enqueueJob(input: DurableJobInput): Promise<void> {
    await this.transaction.insert(jobs).values({
      id: input.id,
      ownerId: input.ownerId,
      jobType: input.jobType,
      payload: input.payload,
      status: 'queued',
      priority: input.priority,
      scheduledFor: new Date(input.scheduledFor),
      availableAfter: new Date(input.availableAfter),
      maximumAttempts: input.maximumAttempts,
      correlationId: input.correlationId,
      causationId: input.causationId,
      sourceEventId: input.sourceEventId,
      idempotencyKey: input.idempotencyKey,
    });

    await this.jobTransport.enqueue(this.transaction, input);
  }

  public async appendAudit(input: AuditEventInput): Promise<void> {
    const safe = createSafeAuditEvent(input);
    await this.transaction.insert(auditEvents).values({
      id: safe.id,
      ownerId: safe.ownerId,
      actorType: safe.actorType,
      actorId: safe.actorId,
      action: safe.action,
      targetType: safe.targetType,
      targetId: safe.targetId,
      occurredAt: new Date(safe.occurredAt),
      correlationId: safe.correlationId,
      causationId: safe.causationId,
      previousStateReference: safe.previousState ?? undefined,
      resultingStateReference: safe.resultingState ?? undefined,
      reason: safe.reason,
      source: safe.source,
      metadata: safe.metadata,
    });
  }

  public async updateEventProcessing(input: {
    readonly event: CanonicalEvent;
    readonly status: EventProcessingStatus;
    readonly processedAt: string;
    readonly summary: string;
  }): Promise<void> {
    const terminal =
      input.status === 'processed' || input.status === 'failed' || input.status === 'ignored';
    const [updated] = await this.transaction
      .update(events)
      .set({
        processingStatus: input.status,
        processingSummary: input.summary,
        ...(terminal ? { processedAt: new Date(input.processedAt) } : {}),
      })
      .where(and(eq(events.id, input.event.id), eq(events.ownerId, input.event.ownerId)))
      .returning({ id: events.id });

    if (!updated) {
      throw new Error('The event-processing update targeted no canonical event.');
    }
  }

  public async persistProposedAction(input: ProposedAction): Promise<{
    readonly action: ProposedAction;
    readonly duplicate: boolean;
  }> {
    const [created] = await this.transaction
      .insert(proposedActions)
      .values({
        id: input.id,
        ownerId: input.ownerId,
        actionType: input.actionType,
        payload: input.payload,
        payloadHash: payloadHash(input.payload),
        riskClass: input.riskClass,
        idempotencyKey: input.idempotencyKey,
        sourceEventId: input.sourceEventId,
        sourceDecisionId: input.sourceDecisionId,
        state: input.state,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        correlationId: input.correlationId,
        causationId: input.causationId,
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      return { action: asProposedAction(created), duplicate: false };
    }

    const [existing] = await this.transaction
      .select()
      .from(proposedActions)
      .where(
        and(
          eq(proposedActions.ownerId, input.ownerId),
          eq(proposedActions.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error(
        'The proposed-action insert conflicted but no canonical action could be found.',
      );
    }

    return { action: asProposedAction(existing), duplicate: true };
  }

  public async persistPolicyEvaluation(input: {
    readonly proposedActionId: string;
    readonly evaluation: PolicyEvaluation;
    readonly correlationId: string;
  }): Promise<void> {
    await this.transaction.insert(policyEvaluations).values({
      ownerId: await this.actionOwnerId(input.proposedActionId),
      proposedActionId: input.proposedActionId,
      allowed: input.evaluation.allowed,
      requiresApproval: input.evaluation.requiresApproval,
      denied: input.evaluation.denied,
      reason: input.evaluation.reason,
      policyVersion: input.evaluation.policyVersion,
      matchedRules: [...input.evaluation.matchedRules],
      correlationId: input.correlationId,
    });
  }

  public async denyAction(input: {
    readonly proposedAction: ProposedAction;
    readonly evaluation: PolicyEvaluation;
  }): Promise<void> {
    const [updated] = await this.transaction
      .update(proposedActions)
      .set({ state: 'denied', updatedAt: new Date() })
      .where(
        and(
          eq(proposedActions.id, input.proposedAction.id),
          eq(proposedActions.ownerId, input.proposedAction.ownerId),
        ),
      )
      .returning({ id: proposedActions.id });

    if (!updated) {
      throw new Error('A policy denial cannot target a missing proposed action.');
    }
  }

  public async createApproval(input: {
    readonly proposedAction: ProposedAction;
    readonly evaluation: PolicyEvaluation;
  }): Promise<void> {
    const requestedAt = new Date();
    const expiresAt = input.proposedAction.expiresAt
      ? new Date(input.proposedAction.expiresAt)
      : new Date(requestedAt.getTime() + 24 * 60 * 60 * 1_000);
    const approval: ApprovalRequest = {
      id: randomUUID(),
      ownerId: input.proposedAction.ownerId,
      proposedActionId: input.proposedAction.id,
      riskClass: input.proposedAction.riskClass,
      actionSnapshotHash: payloadHash({
        actionType: input.proposedAction.actionType,
        id: input.proposedAction.id,
        ownerId: input.proposedAction.ownerId,
        payload: input.proposedAction.payload,
        riskClass: input.proposedAction.riskClass,
      }),
      state: 'pending',
      requestedAt: requestedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      resolvedAt: null,
      actorId: null,
      result: null,
    };

    await this.transaction.insert(approvalRequests).values({
      id: approval.id,
      ownerId: approval.ownerId,
      proposedActionId: approval.proposedActionId,
      actionSnapshotHash: approval.actionSnapshotHash,
      riskClass: approval.riskClass,
      requestedAt,
      expiresAt,
      state: approval.state,
      correlationId: input.proposedAction.correlationId,
    });
    await this.transaction
      .update(proposedActions)
      .set({ state: 'awaiting_approval', updatedAt: requestedAt })
      .where(eq(proposedActions.id, input.proposedAction.id));
  }

  public async executeInternalAction(input: {
    readonly proposedAction: ProposedAction;
    readonly evaluation: PolicyEvaluation;
  }): Promise<InternalActionExecutionResult> {
    if (input.proposedAction.riskClass !== 'LOW_RISK_INTERNAL') {
      throw new Error('Only low-risk internal actions have a Phase 1 execution path.');
    }

    const now = new Date();
    const effect = await this.applyInternalAction(input.proposedAction, now);
    const executionId = randomUUID();
    await this.transaction
      .update(proposedActions)
      .set({ state: 'executed', updatedAt: now })
      .where(eq(proposedActions.id, input.proposedAction.id));
    await this.transaction.insert(actionExecutions).values({
      id: executionId,
      ownerId: input.proposedAction.ownerId,
      proposedActionId: input.proposedAction.id,
      executionAttempt: 1,
      status: 'completed',
      idempotencyKey: input.proposedAction.idempotencyKey,
      startedAt: now,
      completedAt: now,
      correlationId: input.proposedAction.correlationId,
    });
    await this.transaction.insert(actionResults).values({
      ownerId: input.proposedAction.ownerId,
      actionExecutionId: executionId,
      status: 'completed',
      result: {
        policyVersion: input.evaluation.policyVersion,
        result: 'internal_execution_recorded',
        targetId: effect.targetId,
        targetType: effect.targetType,
      },
      correlationId: input.proposedAction.correlationId,
    });

    return effect;
  }

  private async applyInternalAction(
    action: ProposedAction,
    now: Date,
  ): Promise<InternalActionExecutionResult> {
    if (action.actionType === 'internal.commitment.create') {
      const commitmentId = requiredUuid(action.payload, 'commitmentId');
      const title = requiredString(action.payload, 'title');
      const [created] = await this.transaction
        .insert(commitments)
        .values({
          id: commitmentId,
          ownerId: action.ownerId,
          title,
          source: 'internal',
          sourceEventId: action.sourceEventId,
        })
        .onConflictDoNothing()
        .returning({ id: commitments.id });

      if (created) {
        await this.transaction.insert(commitmentStatusHistory).values({
          ownerId: action.ownerId,
          commitmentId,
          previousStatus: null,
          nextStatus: 'open',
          actorType: 'system',
          source: 'internal',
          correlationId: action.correlationId,
        });
      } else {
        await this.assertOwnedCommitment(action.ownerId, commitmentId);
      }

      return {
        targetType: 'commitment',
        targetId: commitmentId,
        previousState: null,
        resultingState: { entityType: 'commitment', entityId: commitmentId },
      };
    }

    if (action.actionType === 'internal.commitment.update') {
      const commitmentId = requiredUuid(action.payload, 'commitmentId');
      const status = requiredString(action.payload, 'status');
      const evidenceReference = requiredString(action.payload, 'completionEvidenceReference');
      if (status !== 'completed') {
        throw new Error('validation: Phase 1 supports only completed commitment transitions.');
      }

      const existing = await this.assertOwnedCommitment(action.ownerId, commitmentId);
      if (existing.status !== 'completed') {
        await this.transaction
          .update(commitments)
          .set({
            status: 'completed',
            completionEvidenceReference: evidenceReference,
            completedAt: now,
            followUpState: 'resolved',
            updatedAt: now,
          })
          .where(and(eq(commitments.id, commitmentId), eq(commitments.ownerId, action.ownerId)));
        await this.transaction.insert(commitmentStatusHistory).values({
          ownerId: action.ownerId,
          commitmentId,
          previousStatus: existing.status,
          nextStatus: 'completed',
          actorType: 'system',
          reason: 'Explicit completion evidence was supplied.',
          evidenceReference,
          source: 'internal',
          correlationId: action.correlationId,
        });
      }

      return {
        targetType: 'commitment',
        targetId: commitmentId,
        previousState: { entityType: 'commitment', entityId: commitmentId },
        resultingState: { entityType: 'commitment', entityId: commitmentId },
      };
    }

    if (action.actionType === 'internal.reminder.create') {
      const reminderId = requiredUuid(action.payload, 'reminderId');
      const title = requiredString(action.payload, 'title');
      const nextEligibleDeliveryAt = requiredTimestamp(action.payload, 'nextEligibleDeliveryAt');
      const [created] = await this.transaction
        .insert(reminders)
        .values({
          id: reminderId,
          ownerId: action.ownerId,
          title,
          nextEligibleDeliveryAt,
          source: 'internal',
        })
        .onConflictDoNothing()
        .returning({ id: reminders.id });

      if (!created) {
        const [existing] = await this.transaction
          .select({ ownerId: reminders.ownerId })
          .from(reminders)
          .where(eq(reminders.id, reminderId))
          .limit(1);
        if (!existing || existing.ownerId !== action.ownerId) {
          throw new Error('A reminder action cannot reuse a record owned by another identity.');
        }
      }

      return {
        targetType: 'reminder',
        targetId: reminderId,
        previousState: null,
        resultingState: { entityType: 'reminder', entityId: reminderId },
      };
    }

    throw new Error(
      `validation: no Phase 1 internal executor is registered for ${action.actionType}.`,
    );
  }

  private async assertOwnedCommitment(ownerId: string, commitmentId: string) {
    const [existing] = await this.transaction
      .select({ id: commitments.id, status: commitments.status })
      .from(commitments)
      .where(and(eq(commitments.id, commitmentId), eq(commitments.ownerId, ownerId)))
      .limit(1);

    if (!existing) {
      throw new Error('A commitment action cannot target a missing or foreign commitment.');
    }

    return existing;
  }

  private async actionOwnerId(actionId: string): Promise<string> {
    const [action] = await this.transaction
      .select({ ownerId: proposedActions.ownerId })
      .from(proposedActions)
      .where(eq(proposedActions.id, actionId))
      .limit(1);

    if (!action) {
      throw new Error('A policy evaluation cannot exist without its proposed action.');
    }

    return action.ownerId;
  }
}

export class DrizzleTransactionalEventStore implements TransactionalEventStore {
  public constructor(
    private readonly database: JarvisDatabase,
    private readonly jobTransport: TransactionalJobTransport,
  ) {}

  public async transaction<T>(
    operation: (transaction: EventTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (transaction) =>
      operation(new DrizzleEventTransaction(transaction, this.jobTransport)),
    );
  }
}
