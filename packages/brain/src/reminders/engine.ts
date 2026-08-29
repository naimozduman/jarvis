import { randomUUID } from 'node:crypto';

import type { ProactiveDeliveryIntent, ReminderProposal } from '@jarvis/contracts';

import { evaluateMessageBudget, type ProactiveMessageBudget } from './message-budget.js';

export interface ReminderEvaluation {
  readonly proposal: ReminderProposal;
  readonly shouldQueueDeliveryIntent: boolean;
  readonly reason: string;
  readonly nextBudget: ProactiveMessageBudget;
}

/** Phase 2 creates only a local delivery intent; no external transport is implemented. */
export class ReminderEngine {
  public evaluate(input: {
    readonly proposal: ReminderProposal;
    readonly budget: ProactiveMessageBudget;
    readonly quietModeActive: boolean;
    readonly grouped: boolean;
  }): ReminderEvaluation {
    const decision = evaluateMessageBudget({
      budget: input.budget,
      critical: input.proposal.critical,
      grouped: input.grouped,
      quietModeActive: input.quietModeActive,
    });
    return {
      proposal: input.proposal,
      shouldQueueDeliveryIntent: decision.allowed,
      reason: decision.reason,
      nextBudget: decision.nextBudget,
    };
  }

  /**
   * Produces a generic, durable-delivery candidate after the existing quiet-mode/message-budget
   * evaluation. It intentionally has no transport, JID, phone number, or provider dependency.
   */
  public createProactiveDeliveryIntent(input: {
    readonly evaluation: ReminderEvaluation;
    readonly message: string;
    readonly correlationId: string;
    readonly causationId: string | null;
    readonly createdAt: string;
  }): ProactiveDeliveryIntent | null {
    if (!input.evaluation.shouldQueueDeliveryIntent) {
      return null;
    }
    return {
      id: randomUUID(),
      ownerId: input.evaluation.proposal.ownerId,
      reminderId: input.evaluation.proposal.id,
      message: input.message,
      critical: input.evaluation.proposal.critical,
      correlationId: input.correlationId,
      causationId: input.causationId,
      createdAt: input.createdAt,
    };
  }
}
