import type { ReminderProposal } from '@jarvis/contracts';

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
}
