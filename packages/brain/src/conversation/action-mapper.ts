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

    // The original intent is not copied into a payload. Policy can still deny an unknown or
    // high-impact known type, while no external endpoint, recipient, or secret is ever exposed.
    return { action: { ...base, payload: {} }, mappingError: null };
  });
}
