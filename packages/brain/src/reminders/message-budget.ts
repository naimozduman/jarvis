export interface ProactiveMessageBudget {
  readonly normalMessageCount: number;
  readonly criticalMessageCount: number;
  readonly groupedMessageCount: number;
  readonly maximumNormalMessages: number;
}

export interface MessageBudgetDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly nextBudget: ProactiveMessageBudget;
}

/** Channel-independent budget gate; a later adapter may deliver only after this deterministic step. */
export function evaluateMessageBudget(input: {
  readonly budget: ProactiveMessageBudget;
  readonly critical: boolean;
  readonly grouped: boolean;
  readonly quietModeActive: boolean;
}): MessageBudgetDecision {
  if (input.quietModeActive && !input.critical) {
    return {
      allowed: false,
      reason: 'Quiet mode suppresses noncritical proactive delivery without changing commitments.',
      nextBudget: input.budget,
    };
  }
  if (input.critical) {
    return {
      allowed: true,
      reason:
        'A critical deadline or safety-relevant notification bypasses the normal message budget.',
      nextBudget: {
        ...input.budget,
        criticalMessageCount: input.budget.criticalMessageCount + 1,
        groupedMessageCount: input.budget.groupedMessageCount + (input.grouped ? 1 : 0),
      },
    };
  }
  if (input.budget.normalMessageCount >= input.budget.maximumNormalMessages) {
    return {
      allowed: false,
      reason: 'The normal proactive message budget is exhausted for this day.',
      nextBudget: input.budget,
    };
  }
  return {
    allowed: true,
    reason: input.grouped
      ? 'A grouped noncritical message is within the daily budget.'
      : 'Within the daily normal message budget.',
    nextBudget: {
      ...input.budget,
      normalMessageCount: input.budget.normalMessageCount + 1,
      groupedMessageCount: input.budget.groupedMessageCount + (input.grouped ? 1 : 0),
    },
  };
}
