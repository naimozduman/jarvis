import type { ConversationResponse } from '@jarvis/contracts';

export interface MutationOutcome {
  readonly subject: 'plan' | 'reminder' | 'action';
  readonly state: 'applied' | 'pending' | 'rejected' | 'unknown';
}

/** Model prose is never a receipt. Only deterministic outcomes can authorize completion wording. */
export function reconcileConversationResponse(
  modelResponse: ConversationResponse | null,
  outcomes: readonly MutationOutcome[],
): ConversationResponse | null {
  if (outcomes.length === 0) return modelResponse;
  const sentences = outcomes.map(({ subject, state }) => {
    const label =
      subject === 'plan' ? 'plan change' : subject === 'reminder' ? 'reminder' : 'action';
    switch (state) {
      case 'applied':
        return subject === 'reminder' ? 'Reminder set.' : `The ${label} was applied.`;
      case 'pending':
        return `The ${label} is proposed and has not been applied.`;
      case 'rejected':
        return `The ${label} could not be applied because it was rejected by validation or policy.`;
      case 'unknown':
        return `I could not confirm whether the ${label} was applied. Its execution status is uncertain.`;
    }
  });
  return { message: [...new Set(sentences)].join(' '), nextAction: null, tone: 'neutral' };
}
