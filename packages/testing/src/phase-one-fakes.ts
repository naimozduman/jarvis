import { randomUUID } from 'node:crypto';

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

export interface StoredEvent {
  readonly event: CanonicalEvent;
  readonly key: string;
}

class InMemoryEventTransaction implements EventTransaction {
  public constructor(private readonly store: InMemoryEventStore) {}

  public async persistEvent(input: {
    readonly ownerId: string;
    readonly envelope: IncomingEventEnvelope;
    readonly receivedAt: string;
    readonly correlationId: string;
  }): Promise<EventPersistenceResult> {
    const key = `${input.ownerId}:${input.envelope.idempotencyKey}`;
    const existing = this.store.eventByIdempotency.get(key);
    if (existing) {
      return { event: existing.event, duplicate: true };
    }

    const event: CanonicalEvent = {
      id: randomUUID(),
      ownerId: input.ownerId,
      eventType: input.envelope.eventType,
      source: input.envelope.source,
      ...(input.envelope.sourceEventId ? { sourceEventId: input.envelope.sourceEventId } : {}),
      idempotencyKey: input.envelope.idempotencyKey,
      occurredAt: input.envelope.occurredAt,
      receivedAt: input.receivedAt,
      payload: input.envelope.payload,
      schemaVersion: input.envelope.schemaVersion,
      processingStatus: 'queued',
      correlationId: input.envelope.correlationId ?? input.correlationId,
      ...(input.envelope.causationId ? { causationId: input.envelope.causationId } : {}),
    };

    this.store.eventByIdempotency.set(key, { event, key });
    return { event, duplicate: false };
  }

  public async enqueueJob(input: DurableJobInput): Promise<void> {
    this.store.jobs.push(input);
  }

  public async appendAudit(input: AuditEventInput): Promise<void> {
    this.store.auditEvents.push(input);
  }

  public async updateEventProcessing(input: {
    readonly event: CanonicalEvent;
    readonly status: EventProcessingStatus;
    readonly processedAt: string;
    readonly summary: string;
  }): Promise<void> {
    for (const [key, stored] of this.store.eventByIdempotency.entries()) {
      if (stored.event.id === input.event.id) {
        this.store.eventByIdempotency.set(key, {
          ...stored,
          event: {
            ...stored.event,
            processingStatus: input.status,
          },
        });
        return;
      }
    }

    throw new Error('The fake event store cannot update a missing event.');
  }

  public async persistProposedAction(input: ProposedAction): Promise<{
    readonly action: ProposedAction;
    readonly duplicate: boolean;
  }> {
    const key = `${input.ownerId}:${input.idempotencyKey}`;
    const existing = this.store.actionsByIdempotency.get(key);
    if (existing) {
      return { action: existing, duplicate: true };
    }

    this.store.actionsByIdempotency.set(key, input);
    return { action: input, duplicate: false };
  }

  public async persistPolicyEvaluation(input: {
    readonly proposedActionId: string;
    readonly evaluation: PolicyEvaluation;
    readonly correlationId: string;
  }): Promise<void> {
    this.store.policyEvaluations.push(input);
  }

  public async denyAction(input: {
    readonly proposedAction: ProposedAction;
    readonly evaluation: PolicyEvaluation;
  }): Promise<void> {
    this.updateActionState(input.proposedAction, 'denied');
  }

  public async createApproval(input: {
    readonly proposedAction: ProposedAction;
    readonly evaluation: PolicyEvaluation;
  }): Promise<void> {
    this.updateActionState(input.proposedAction, 'awaiting_approval');
    this.store.approvalRequests.push({
      id: randomUUID(),
      ownerId: input.proposedAction.ownerId,
      proposedActionId: input.proposedAction.id,
      riskClass: input.proposedAction.riskClass,
      actionSnapshotHash: '0'.repeat(64),
      state: 'pending',
      requestedAt: new Date(0).toISOString(),
      expiresAt: new Date(86_400_000).toISOString(),
      resolvedAt: null,
      actorId: null,
      result: null,
    });
  }

  public async executeInternalAction(input: {
    readonly proposedAction: ProposedAction;
    readonly evaluation: PolicyEvaluation;
  }): Promise<InternalActionExecutionResult> {
    this.updateActionState(input.proposedAction, 'executed');
    const executed = { ...input.proposedAction, state: 'executed' as const };
    this.store.executedActions.push(executed);
    return {
      targetType: 'proposed_action',
      targetId: input.proposedAction.id,
      previousState: { entityType: 'proposed_action', entityId: input.proposedAction.id },
      resultingState: { entityType: 'proposed_action', entityId: input.proposedAction.id },
    };
  }

  private updateActionState(action: ProposedAction, state: ProposedAction['state']): void {
    const key = `${action.ownerId}:${action.idempotencyKey}`;
    const current = this.store.actionsByIdempotency.get(key);
    if (!current) {
      throw new Error('The fake event store cannot update a missing proposed action.');
    }

    this.store.actionsByIdempotency.set(key, { ...current, state });
  }
}

/** Provider-free transactional port fake for Phase 1 pipeline smoke tests. */
export class InMemoryEventStore implements TransactionalEventStore {
  public readonly eventByIdempotency = new Map<string, StoredEvent>();
  public readonly jobs: DurableJobInput[] = [];
  public readonly auditEvents: AuditEventInput[] = [];
  public readonly actionsByIdempotency = new Map<string, ProposedAction>();
  public readonly policyEvaluations: {
    readonly proposedActionId: string;
    readonly evaluation: PolicyEvaluation;
    readonly correlationId: string;
  }[] = [];
  public readonly approvalRequests: ApprovalRequest[] = [];
  public readonly executedActions: ProposedAction[] = [];

  public async transaction<T>(
    operation: (transaction: EventTransaction) => Promise<T>,
  ): Promise<T> {
    return operation(new InMemoryEventTransaction(this));
  }

  /** Seeds a previously durable event for a processor-only test; production ingress never uses it. */
  public seedEvent(event: CanonicalEvent): void {
    const key = `${event.ownerId}:${event.idempotencyKey}`;
    this.eventByIdempotency.set(key, { event, key });
  }

  public get events(): readonly CanonicalEvent[] {
    return [...this.eventByIdempotency.values()].map((entry) => entry.event);
  }

  public get actions(): readonly ProposedAction[] {
    return [...this.actionsByIdempotency.values()];
  }
}
