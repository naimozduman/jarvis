import { randomUUID } from 'node:crypto';

import type {
  AuditEventInput,
  CanonicalEvent,
  DurableJobInput,
  EventProcessingStatus,
  IncomingEventEnvelope,
  PolicyEvaluation,
  ProposedAction,
} from '@jarvis/contracts';

export const deterministicPhaseOneEventTypes = [
  'internal.commitment.create.v1',
  'internal.commitment.complete.v1',
  'internal.reminder.schedule.v1',
  'internal.action.propose.v1',
] as const;

export type DeterministicPhaseOneEventType = (typeof deterministicPhaseOneEventTypes)[number];

export interface EventPersistenceResult {
  readonly event: CanonicalEvent;
  readonly duplicate: boolean;
}

export interface InternalActionExecutionResult {
  readonly targetType: string;
  readonly targetId: AuditEventInput['targetId'];
  readonly previousState: AuditEventInput['previousState'];
  readonly resultingState: AuditEventInput['resultingState'];
}

export interface EventTransaction {
  persistEvent(input: {
    readonly ownerId: string;
    readonly envelope: IncomingEventEnvelope;
    readonly receivedAt: string;
    readonly correlationId: string;
  }): Promise<EventPersistenceResult>;
  enqueueJob(input: DurableJobInput): Promise<void>;
  appendAudit(input: AuditEventInput): Promise<void>;
  updateEventProcessing(input: {
    readonly event: CanonicalEvent;
    readonly status: EventProcessingStatus;
    readonly processedAt: string;
    readonly summary: string;
  }): Promise<void>;
  persistProposedAction(input: ProposedAction): Promise<{
    readonly action: ProposedAction;
    readonly duplicate: boolean;
  }>;
  persistPolicyEvaluation(input: {
    readonly proposedActionId: string;
    readonly evaluation: PolicyEvaluation;
    readonly correlationId: string;
  }): Promise<void>;
  denyAction(input: {
    readonly proposedAction: ProposedAction;
    readonly evaluation: PolicyEvaluation;
  }): Promise<void>;
  createApproval(input: {
    readonly proposedAction: ProposedAction;
    readonly evaluation: PolicyEvaluation;
  }): Promise<void>;
  executeInternalAction(input: {
    readonly proposedAction: ProposedAction;
    readonly evaluation: PolicyEvaluation;
  }): Promise<InternalActionExecutionResult>;
}

export interface TransactionalEventStore {
  transaction<T>(operation: (transaction: EventTransaction) => Promise<T>): Promise<T>;
}

export interface DeterministicHandlerResult {
  readonly action: ProposedAction | undefined;
  readonly audit: readonly AuditEventInput[];
}

export interface DeterministicEventHandler {
  readonly eventType: string;
  handle(event: CanonicalEvent): Promise<DeterministicHandlerResult>;
}

export interface PolicyEvaluatorPort {
  evaluate(action: ProposedAction): PolicyEvaluation;
}

export interface EventPipelineDependencies {
  readonly store: TransactionalEventStore;
  readonly handlers: ReadonlyMap<string, DeterministicEventHandler>;
  readonly policy: PolicyEvaluatorPort;
  readonly createJob: (event: CanonicalEvent) => DurableJobInput;
}

export interface IngestEventInput {
  readonly ownerId: string;
  readonly envelope: IncomingEventEnvelope;
  readonly receivedAt: string;
  readonly correlationId: string;
}

export interface IngestEventResult {
  readonly event: CanonicalEvent;
  readonly duplicate: boolean;
  readonly jobQueued: boolean;
}

function auditMutation(input: Omit<AuditEventInput, 'id' | 'occurredAt'>): AuditEventInput {
  return {
    ...input,
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
  };
}

function eventAudit(
  event: CanonicalEvent,
  action: string,
  reason: string,
  metadata: Record<string, unknown>,
): AuditEventInput {
  return auditMutation({
    ownerId: event.ownerId,
    actorType: 'worker',
    actorId: null,
    action,
    targetType: 'event',
    targetId: event.id,
    correlationId: event.correlationId,
    ...(event.causationId ? { causationId: event.causationId } : {}),
    previousState: { entityType: 'event', entityId: event.id },
    resultingState: { entityType: 'event', entityId: event.id },
    reason,
    source: event.source,
    metadata,
  });
}

async function finishEvent(
  transaction: EventTransaction,
  event: CanonicalEvent,
  summary: string,
): Promise<void> {
  await transaction.updateEventProcessing({
    event,
    status: 'processed',
    processedAt: new Date().toISOString(),
    summary,
  });
  await transaction.appendAudit(
    eventAudit(event, 'event.processed', summary, { eventType: event.eventType }),
  );
}

/**
 * Performs the durable ingress half of the canonical pipeline. The store owns the database
 * transaction, so a newly persisted event, job intent/transport entry, and audit record commit or
 * roll back together. A duplicate returns the existing canonical event without a second job.
 */
export async function ingestCanonicalEvent(
  dependencies: EventPipelineDependencies,
  input: IngestEventInput,
): Promise<IngestEventResult> {
  return dependencies.store.transaction(async (transaction) => {
    const persisted = await transaction.persistEvent({
      ownerId: input.ownerId,
      envelope: input.envelope,
      receivedAt: input.receivedAt,
      correlationId: input.correlationId,
    });

    if (persisted.duplicate) {
      return {
        event: persisted.event,
        duplicate: true,
        jobQueued: false,
      };
    }

    const job = dependencies.createJob(persisted.event);
    await transaction.enqueueJob(job);
    await transaction.appendAudit({
      id: randomUUID(),
      ownerId: persisted.event.ownerId,
      actorType: 'system',
      actorId: null,
      action: 'event.received',
      targetType: 'event',
      targetId: persisted.event.id,
      occurredAt: input.receivedAt,
      correlationId: persisted.event.correlationId,
      ...(persisted.event.causationId ? { causationId: persisted.event.causationId } : {}),
      previousState: null,
      resultingState: { entityType: 'event', entityId: persisted.event.id },
      reason: null,
      source: persisted.event.source,
      metadata: {
        eventType: persisted.event.eventType,
        processingStatus: persisted.event.processingStatus,
      },
    });
    await transaction.appendAudit(
      auditMutation({
        ownerId: persisted.event.ownerId,
        actorType: 'system',
        actorId: null,
        action: 'job.queued',
        targetType: 'job',
        targetId: job.id,
        correlationId: persisted.event.correlationId,
        ...(persisted.event.causationId ? { causationId: persisted.event.causationId } : {}),
        previousState: null,
        resultingState: { entityType: 'job', entityId: job.id },
        reason: 'An accepted event requires deterministic processing.',
        source: persisted.event.source,
        metadata: { jobType: job.jobType },
      }),
    );

    return {
      event: persisted.event,
      duplicate: false,
      jobQueued: true,
    };
  });
}

export interface ProcessEventResult {
  readonly processed: boolean;
  readonly actionId: string | undefined;
  readonly approvalRequested: boolean;
}

export interface ProposedActionPipelineInput {
  readonly action: ProposedAction;
  /** Safe provenance label for audit; it is never model-provided free-form text. */
  readonly source: 'brain' | 'internal';
  readonly reason: string;
}

export interface ProcessProposedActionResult {
  readonly actionId: string;
  readonly duplicate: boolean;
  readonly approvalRequested: boolean;
  readonly denied: boolean;
  readonly executed: boolean;
  readonly evaluation: PolicyEvaluation;
}

/**
 * Shared action boundary for deterministic handlers and the Phase 2 brain. The brain can supply a
 * typed proposal, but it cannot persist state outside this transaction, evaluate policy itself, or
 * call an executor directly. A duplicate idempotency key has no second policy/approval/execution.
 */
export async function processProposedAction(
  dependencies: Pick<EventPipelineDependencies, 'store' | 'policy'>,
  input: ProposedActionPipelineInput,
): Promise<ProcessProposedActionResult> {
  return dependencies.store.transaction(async (transaction) => {
    const actionResult = await transaction.persistProposedAction(input.action);
    const action = actionResult.action;

    if (actionResult.duplicate) {
      return {
        actionId: action.id,
        duplicate: true,
        approvalRequested: false,
        denied: false,
        executed: false,
        evaluation: {
          allowed: false,
          requiresApproval: false,
          denied: false,
          reason: 'The proposed action already exists for this owner and idempotency key.',
          policyVersion: 'not_re_evaluated_duplicate',
          matchedRules: ['action.idempotency.duplicate'],
        },
      };
    }

    await transaction.appendAudit(
      auditMutation({
        ownerId: action.ownerId,
        actorType: input.source === 'brain' ? 'service' : 'worker',
        actorId: null,
        action: 'action.proposed',
        targetType: 'proposed_action',
        targetId: action.id,
        correlationId: action.correlationId,
        ...(action.causationId ? { causationId: action.causationId } : {}),
        previousState: null,
        resultingState: { entityType: 'proposed_action', entityId: action.id },
        reason: input.reason,
        source: input.source,
        metadata: { actionType: action.actionType, riskClass: action.riskClass },
      }),
    );

    const evaluation = dependencies.policy.evaluate(action);
    await transaction.persistPolicyEvaluation({
      proposedActionId: action.id,
      evaluation,
      correlationId: action.correlationId,
    });
    await transaction.appendAudit(
      auditMutation({
        ownerId: action.ownerId,
        actorType: 'system',
        actorId: null,
        action: 'policy.evaluated',
        targetType: 'proposed_action',
        targetId: action.id,
        correlationId: action.correlationId,
        ...(action.causationId ? { causationId: action.causationId } : {}),
        previousState: { entityType: 'proposed_action', entityId: action.id },
        resultingState: { entityType: 'proposed_action', entityId: action.id },
        reason: evaluation.reason,
        source: 'internal',
        metadata: {
          allowed: evaluation.allowed,
          denied: evaluation.denied,
          policyVersion: evaluation.policyVersion,
          requiresApproval: evaluation.requiresApproval,
        },
      }),
    );

    if (evaluation.requiresApproval) {
      await transaction.createApproval({ proposedAction: action, evaluation });
      await transaction.appendAudit(
        auditMutation({
          ownerId: action.ownerId,
          actorType: 'system',
          actorId: null,
          action: 'approval.requested',
          targetType: 'proposed_action',
          targetId: action.id,
          correlationId: action.correlationId,
          ...(action.causationId ? { causationId: action.causationId } : {}),
          previousState: { entityType: 'proposed_action', entityId: action.id },
          resultingState: { entityType: 'proposed_action', entityId: action.id },
          reason: evaluation.reason,
          source: 'internal',
          metadata: { riskClass: action.riskClass },
        }),
      );
      return {
        actionId: action.id,
        duplicate: false,
        approvalRequested: true,
        denied: false,
        executed: false,
        evaluation,
      };
    }

    if (evaluation.denied) {
      await transaction.denyAction({ proposedAction: action, evaluation });
      await transaction.appendAudit(
        auditMutation({
          ownerId: action.ownerId,
          actorType: 'system',
          actorId: null,
          action: 'action.denied',
          targetType: 'proposed_action',
          targetId: action.id,
          correlationId: action.correlationId,
          ...(action.causationId ? { causationId: action.causationId } : {}),
          previousState: { entityType: 'proposed_action', entityId: action.id },
          resultingState: { entityType: 'proposed_action', entityId: action.id },
          reason: evaluation.reason,
          source: 'internal',
          metadata: { policyVersion: evaluation.policyVersion },
        }),
      );
      return {
        actionId: action.id,
        duplicate: false,
        approvalRequested: false,
        denied: true,
        executed: false,
        evaluation,
      };
    }

    if (!evaluation.allowed) {
      throw new Error('Policy evaluation must be allowed, denied, or require explicit approval.');
    }

    const execution = await transaction.executeInternalAction({
      proposedAction: action,
      evaluation,
    });
    await transaction.appendAudit(
      auditMutation({
        ownerId: action.ownerId,
        actorType: 'worker',
        actorId: null,
        action: 'action.executed',
        targetType: execution.targetType,
        targetId: execution.targetId,
        correlationId: action.correlationId,
        ...(action.causationId ? { causationId: action.causationId } : {}),
        previousState: execution.previousState,
        resultingState: execution.resultingState,
        reason: evaluation.reason,
        source: 'internal',
        metadata: { actionType: action.actionType, policyVersion: evaluation.policyVersion },
      }),
    );
    return {
      actionId: action.id,
      duplicate: false,
      approvalRequested: false,
      denied: false,
      executed: true,
      evaluation,
    };
  });
}

/**
 * Executes deterministic Phase 1 handler logic only. It has no model or provider pathway. A
 * high-impact action is persisted for approval and never sent to an executor here.
 */
export async function processCanonicalEvent(
  dependencies: Pick<EventPipelineDependencies, 'store' | 'handlers' | 'policy'>,
  event: CanonicalEvent,
): Promise<ProcessEventResult> {
  const handler = dependencies.handlers.get(event.eventType);

  if (!handler) {
    return dependencies.store.transaction(async (transaction) => {
      const summary = 'No deterministic Phase 1 handler is registered for this event type.';
      await transaction.updateEventProcessing({
        event,
        status: 'ignored',
        processedAt: new Date().toISOString(),
        summary,
      });
      await transaction.appendAudit(
        eventAudit(event, 'event.ignored', summary, { eventType: event.eventType }),
      );
      return { processed: false, actionId: undefined, approvalRequested: false };
    });
  }

  return dependencies.store.transaction(async (transaction) => {
    await transaction.updateEventProcessing({
      event,
      status: 'processing',
      processedAt: new Date().toISOString(),
      summary: 'A deterministic Phase 1 handler started processing the event.',
    });
    await transaction.appendAudit(
      eventAudit(event, 'event.processing.started', 'A deterministic Phase 1 handler started.', {
        eventType: event.eventType,
      }),
    );

    const result = await handler.handle(event);

    for (const audit of result.audit) {
      await transaction.appendAudit(audit);
    }

    if (!result.action) {
      await finishEvent(
        transaction,
        event,
        'The deterministic handler completed without an action.',
      );
      return { processed: true, actionId: undefined, approvalRequested: false };
    }

    const actionResult = await transaction.persistProposedAction(result.action);
    if (actionResult.duplicate) {
      await finishEvent(
        transaction,
        event,
        'The deterministic action already exists for this event.',
      );
      return {
        processed: true,
        actionId: actionResult.action.id,
        approvalRequested: false,
      };
    }

    await transaction.appendAudit(
      auditMutation({
        ownerId: actionResult.action.ownerId,
        actorType: 'worker',
        actorId: null,
        action: 'action.proposed',
        targetType: 'proposed_action',
        targetId: actionResult.action.id,
        correlationId: actionResult.action.correlationId,
        ...(actionResult.action.causationId
          ? { causationId: actionResult.action.causationId }
          : {}),
        previousState: null,
        resultingState: { entityType: 'proposed_action', entityId: actionResult.action.id },
        reason: 'A deterministic handler proposed an action.',
        source: event.source,
        metadata: {
          actionType: actionResult.action.actionType,
          riskClass: actionResult.action.riskClass,
        },
      }),
    );

    const evaluation = dependencies.policy.evaluate(actionResult.action);
    await transaction.persistPolicyEvaluation({
      proposedActionId: actionResult.action.id,
      evaluation,
      correlationId: actionResult.action.correlationId,
    });
    await transaction.appendAudit(
      auditMutation({
        ownerId: actionResult.action.ownerId,
        actorType: 'system',
        actorId: null,
        action: 'policy.evaluated',
        targetType: 'proposed_action',
        targetId: actionResult.action.id,
        correlationId: actionResult.action.correlationId,
        ...(actionResult.action.causationId
          ? { causationId: actionResult.action.causationId }
          : {}),
        previousState: { entityType: 'proposed_action', entityId: actionResult.action.id },
        resultingState: { entityType: 'proposed_action', entityId: actionResult.action.id },
        reason: evaluation.reason,
        source: 'internal',
        metadata: {
          allowed: evaluation.allowed,
          denied: evaluation.denied,
          policyVersion: evaluation.policyVersion,
          requiresApproval: evaluation.requiresApproval,
        },
      }),
    );

    if (evaluation.requiresApproval) {
      await transaction.createApproval({
        proposedAction: actionResult.action,
        evaluation,
      });
      await transaction.appendAudit(
        auditMutation({
          ownerId: actionResult.action.ownerId,
          actorType: 'system',
          actorId: null,
          action: 'approval.requested',
          targetType: 'proposed_action',
          targetId: actionResult.action.id,
          correlationId: actionResult.action.correlationId,
          ...(actionResult.action.causationId
            ? { causationId: actionResult.action.causationId }
            : {}),
          previousState: { entityType: 'proposed_action', entityId: actionResult.action.id },
          resultingState: { entityType: 'proposed_action', entityId: actionResult.action.id },
          reason: evaluation.reason,
          source: 'internal',
          metadata: { riskClass: actionResult.action.riskClass },
        }),
      );
      await finishEvent(
        transaction,
        event,
        'The event produced an action awaiting explicit owner approval.',
      );
      return { processed: true, actionId: actionResult.action.id, approvalRequested: true };
    }

    if (evaluation.denied) {
      await transaction.denyAction({ proposedAction: actionResult.action, evaluation });
      await transaction.appendAudit(
        auditMutation({
          ownerId: actionResult.action.ownerId,
          actorType: 'system',
          actorId: null,
          action: 'action.denied',
          targetType: 'proposed_action',
          targetId: actionResult.action.id,
          correlationId: actionResult.action.correlationId,
          ...(actionResult.action.causationId
            ? { causationId: actionResult.action.causationId }
            : {}),
          previousState: { entityType: 'proposed_action', entityId: actionResult.action.id },
          resultingState: { entityType: 'proposed_action', entityId: actionResult.action.id },
          reason: evaluation.reason,
          source: 'internal',
          metadata: { policyVersion: evaluation.policyVersion },
        }),
      );
      await finishEvent(transaction, event, 'The event produced a policy-denied action.');
      return { processed: true, actionId: actionResult.action.id, approvalRequested: false };
    }

    if (!evaluation.allowed) {
      throw new Error('Policy evaluation must be allowed, denied, or require explicit approval.');
    }

    const execution = await transaction.executeInternalAction({
      proposedAction: actionResult.action,
      evaluation,
    });
    await transaction.appendAudit(
      auditMutation({
        ownerId: actionResult.action.ownerId,
        actorType: 'worker',
        actorId: null,
        action: 'action.executed',
        targetType: execution.targetType,
        targetId: execution.targetId,
        correlationId: actionResult.action.correlationId,
        ...(actionResult.action.causationId
          ? { causationId: actionResult.action.causationId }
          : {}),
        previousState: execution.previousState,
        resultingState: execution.resultingState,
        reason: evaluation.reason,
        source: 'internal',
        metadata: {
          actionType: actionResult.action.actionType,
          policyVersion: evaluation.policyVersion,
        },
      }),
    );
    await finishEvent(transaction, event, 'The deterministic Phase 1 event pipeline completed.');

    return { processed: true, actionId: actionResult.action.id, approvalRequested: false };
  });
}
