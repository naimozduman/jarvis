import { createHash, randomUUID } from 'node:crypto';

import type { AuditEventInput, CanonicalEvent, ProposedAction } from '@jarvis/contracts';

import type { DeterministicEventHandler, DeterministicHandlerResult } from './pipeline.js';

function actionKey(event: CanonicalEvent, actionType: string): string {
  return `action:${createHash('sha256')
    .update(`${event.ownerId}:${event.id}:${actionType}`, 'utf8')
    .digest('hex')}`;
}

function audit(event: CanonicalEvent, action: string, targetId: string): AuditEventInput {
  return {
    id: randomUUID(),
    ownerId: event.ownerId,
    actorType: 'system',
    actorId: null,
    action,
    targetType: 'event',
    targetId,
    occurredAt: event.receivedAt,
    correlationId: event.correlationId,
    ...(event.causationId ? { causationId: event.causationId } : {}),
    previousState: null,
    resultingState: null,
    reason: null,
    source: event.source,
    metadata: {
      eventType: event.eventType,
    },
  };
}

function requiredString(payload: Readonly<Record<string, unknown>>, name: string): string {
  const value = payload[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`validation: ${name} is required for this deterministic event.`);
  }

  return value;
}

function lowRiskAction(
  event: CanonicalEvent,
  actionType: string,
  payload: Readonly<Record<string, unknown>>,
): ProposedAction {
  return {
    id: randomUUID(),
    ownerId: event.ownerId,
    actionType,
    payload: { ...payload },
    riskClass: 'LOW_RISK_INTERNAL',
    idempotencyKey: actionKey(event, actionType),
    sourceEventId: event.id,
    correlationId: event.correlationId,
    ...(event.causationId ? { causationId: event.causationId } : {}),
    state: 'proposed',
    expiresAt: null,
  };
}

class CommitmentCreateHandler implements DeterministicEventHandler {
  public readonly eventType = 'internal.commitment.create.v1';

  public async handle(event: CanonicalEvent): Promise<DeterministicHandlerResult> {
    const commitmentId = requiredString(event.payload, 'commitmentId');
    const title = requiredString(event.payload, 'title');

    return {
      action: lowRiskAction(event, 'internal.commitment.create', {
        commitmentId,
        title,
      }),
      audit: [audit(event, 'commitment.create.proposed', commitmentId)],
    };
  }
}

class CommitmentCompleteHandler implements DeterministicEventHandler {
  public readonly eventType = 'internal.commitment.complete.v1';

  public async handle(event: CanonicalEvent): Promise<DeterministicHandlerResult> {
    const commitmentId = requiredString(event.payload, 'commitmentId');
    const completionEvidenceReference = requiredString(
      event.payload,
      'completionEvidenceReference',
    );

    return {
      action: lowRiskAction(event, 'internal.commitment.update', {
        commitmentId,
        completionEvidenceReference,
        status: 'completed',
      }),
      audit: [audit(event, 'commitment.complete.proposed', commitmentId)],
    };
  }
}

class ReminderScheduleHandler implements DeterministicEventHandler {
  public readonly eventType = 'internal.reminder.schedule.v1';

  public async handle(event: CanonicalEvent): Promise<DeterministicHandlerResult> {
    const reminderId = requiredString(event.payload, 'reminderId');
    const title = requiredString(event.payload, 'title');
    const nextEligibleDeliveryAt = requiredString(event.payload, 'nextEligibleDeliveryAt');

    return {
      action: lowRiskAction(event, 'internal.reminder.create', {
        nextEligibleDeliveryAt,
        reminderId,
        title,
      }),
      audit: [audit(event, 'reminder.schedule.proposed', reminderId)],
    };
  }
}

/** These deterministic handlers are intentionally the only Phase 1 pipeline behavior. */
export function createDeterministicPhaseOneHandlers(): ReadonlyMap<
  string,
  DeterministicEventHandler
> {
  const handlers: readonly DeterministicEventHandler[] = [
    new CommitmentCreateHandler(),
    new CommitmentCompleteHandler(),
    new ReminderScheduleHandler(),
  ];

  return new Map(handlers.map((handler) => [handler.eventType, handler]));
}
