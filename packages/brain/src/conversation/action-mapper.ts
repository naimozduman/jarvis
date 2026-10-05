import { randomUUID } from 'node:crypto';

import type {
  BrainRequest,
  ModelActionProposal,
  PlanProposal,
  ProposedAction,
  ReminderProposal,
} from '@jarvis/contracts';

export interface MappedActionIntent {
  readonly action: ProposedAction;
  readonly mappingError: string | null;
}

/**
 * The plan operation is already fully materialized and validated by the server.  This is not a
 * model action: it deliberately derives its payload, provenance, and idempotency key only from
 * trusted request and proposal state.
 */
export function materializeValidatedPlanAction(input: {
  readonly request: BrainRequest;
  readonly decisionId: string;
  readonly planProposal: PlanProposal | null;
}): MappedActionIntent | null {
  const proposal = input.planProposal;
  if (
    !proposal?.valid ||
    proposal.contractVersion !== 'flexible_delta_v2' ||
    !proposal.commitmentSchedules?.length
  ) {
    return null;
  }

  return {
    action: {
      id: randomUUID(),
      ownerId: input.request.ownerId,
      actionType: 'internal.plan.update',
      // The executor re-reads this immutable, validated proposal under the day-plan lock. Its
      // commitmentSchedules bindings carry the canonical commitment metadata provenance.
      payload: { dayPlanId: proposal.dayPlanId, planProposalId: proposal.id },
      riskClass: 'LOW_RISK_INTERNAL',
      idempotencyKey: `brain:validated-plan:${input.request.id}:${proposal.id}`,
      ...(input.request.sourceEventId ? { sourceEventId: input.request.sourceEventId } : {}),
      sourceBrainDecisionId: input.decisionId,
      correlationId: input.request.correlationId,
      ...(input.request.causationId ? { causationId: input.request.causationId } : {}),
      state: 'proposed',
      expiresAt: null,
    },
    mappingError: null,
  };
}

/** Typed reminder intent never needs a separate model-invented executable action. */
export function materializeValidatedReminderAction(input: {
  readonly request: BrainRequest;
  readonly decisionId: string;
  readonly reminderProposal: ReminderProposal | null;
}): MappedActionIntent | null {
  const proposal = input.reminderProposal;
  if (!proposal?.scheduledFor) return null;
  return {
    action: {
      id: randomUUID(),
      ownerId: input.request.ownerId,
      actionType: 'internal.reminder.create',
      payload: {
        reminderId: proposal.id,
        reminderProposalId: proposal.id,
        ...(proposal.commitmentId ? { commitmentId: proposal.commitmentId } : {}),
        title: proposal.title,
        nextEligibleDeliveryAt: proposal.scheduledFor,
      },
      riskClass: 'LOW_RISK_INTERNAL',
      idempotencyKey: `brain:validated-reminder:${input.request.id}:${proposal.id}`,
      ...(input.request.sourceEventId ? { sourceEventId: input.request.sourceEventId } : {}),
      sourceBrainDecisionId: input.decisionId,
      correlationId: input.request.correlationId,
      ...(input.request.causationId ? { causationId: input.request.causationId } : {}),
      state: 'proposed',
      expiresAt: null,
    },
    mappingError: null,
  };
}

function invalidAction(input: {
  readonly request: BrainRequest;
  readonly decisionId: string;
  readonly index: number;
  readonly reason: string;
}): MappedActionIntent {
  return {
    action: {
      id: randomUUID(),
      ownerId: input.request.ownerId,
      actionType: 'internal.invalid_model_action',
      payload: {},
      riskClass: 'LOW_RISK_INTERNAL',
      idempotencyKey: `brain:${input.request.id}:${input.index}`,
      ...(input.request.sourceEventId ? { sourceEventId: input.request.sourceEventId } : {}),
      sourceBrainDecisionId: input.decisionId,
      correlationId: input.request.correlationId,
      ...(input.request.causationId ? { causationId: input.request.causationId } : {}),
      state: 'proposed',
      expiresAt: null,
    },
    mappingError: input.reason,
  };
}

/**
 * Converts model intent into a small allowlisted payload. The model never supplies arbitrary JSON,
 * server identifiers, or executable instructions. Unknown and incomplete intents are persisted only
 * as a policy-denied sentinel so they cannot accidentally reach an internal executor.
 */
export function mapModelActions(input: {
  readonly request: BrainRequest;
  readonly decisionId: string;
  readonly intents: readonly ModelActionProposal[];
  readonly planProposal: PlanProposal | null;
  readonly reminderProposal: ReminderProposal | null;
}): readonly MappedActionIntent[] {
  return input.intents.map((intent, index) => {
    const base = {
      id: randomUUID(),
      ownerId: input.request.ownerId,
      actionType: intent.actionType,
      riskClass: intent.riskClass,
      idempotencyKey: `brain:${input.request.id}:${index}`,
      ...(input.request.sourceEventId ? { sourceEventId: input.request.sourceEventId } : {}),
      sourceBrainDecisionId: input.decisionId,
      correlationId: input.request.correlationId,
      ...(input.request.causationId ? { causationId: input.request.causationId } : {}),
      state: 'proposed' as const,
      expiresAt: null,
    };

    if (intent.actionType === 'internal.commitment.create') {
      if (!intent.title) {
        return invalidAction({
          request: input.request,
          decisionId: input.decisionId,
          index,
          reason: 'A commitment creation intent requires a title.',
        });
      }
      return {
        action: { ...base, payload: { commitmentId: randomUUID(), title: intent.title } },
        mappingError: null,
      };
    }
    if (intent.actionType === 'internal.commitment.update') {
      if (!intent.targetRecordId || !intent.completionEvidenceId) {
        return invalidAction({
          request: input.request,
          decisionId: input.decisionId,
          index,
          reason: 'A commitment completion intent requires a known target and explicit evidence.',
        });
      }
      return {
        action: {
          ...base,
          payload: {
            commitmentId: intent.targetRecordId,
            status: 'completed',
            completionEvidenceReference: intent.completionEvidenceId,
          },
        },
        mappingError: null,
      };
    }
    if (intent.actionType === 'internal.reminder.create') {
      const proposal = input.reminderProposal;
      if (!proposal || !proposal.scheduledFor) {
        return invalidAction({
          request: input.request,
          decisionId: input.decisionId,
          index,
          reason:
            'A reminder action requires a valid server-materialized reminder proposal and schedule.',
        });
      }
      return {
        action: {
          ...base,
          payload: {
            reminderId: proposal.id,
            title: proposal.title,
            nextEligibleDeliveryAt: proposal.scheduledFor,
          },
        },
        mappingError: null,
      };
    }
    if (intent.actionType === 'internal.plan.update') {
      const proposal = input.planProposal;
      if (!proposal || !proposal.valid) {
        return invalidAction({
          request: input.request,
          decisionId: input.decisionId,
          index,
          reason: 'A plan update requires a server-validated plan proposal.',
        });
      }
      return {
        action: {
          ...base,
          payload: { dayPlanId: proposal.dayPlanId, planProposalId: proposal.id },
        },
        mappingError: null,
      };
    }

    // Preserve registered approval/denial-only boundaries. No model recipient/payload is executable.
    const approvalOnlyTypes = [
      'external.message.send',
      'email.send',
      'appointment.cancel',
      'important.data.delete',
      'calendar.event.write',
      'email.archive',
    ] as const;
    const registered = approvalOnlyTypes.find((type) => type === intent.actionType);
    if (registered)
      return { action: { ...base, actionType: registered, payload: {} }, mappingError: null };
    return invalidAction({
      request: input.request,
      decisionId: input.decisionId,
      index,
      reason: 'The model intent is not in the server action mapper allowlist.',
    });
  });
}
