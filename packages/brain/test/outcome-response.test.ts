import { describe, expect, it } from 'vitest';
import { reconcileConversationResponse } from '../src/conversation/outcome-response.js';

const claimedSuccess = {
  message: 'Moved it and scheduled the reminder.',
  nextAction: 'It is done.',
  tone: 'warm' as const,
};
describe('deterministic conversational truth', () => {
  it.each(['plan', 'reminder', 'action'] as const)(
    'replaces rejected %s success and next action',
    (subject) => {
      expect(
        reconcileConversationResponse(claimedSuccess, [{ subject, state: 'rejected' }]),
      ).toEqual({
        message: `The ${subject === 'plan' ? 'plan change' : subject} could not be applied because it was rejected by validation or policy.`,
        nextAction: null,
        tone: 'neutral',
      });
    },
  );
  it('keeps pending proposals distinct from applied mutations', () => {
    const result = reconcileConversationResponse(claimedSuccess, [
      { subject: 'plan', state: 'applied' },
      { subject: 'reminder', state: 'pending' },
    ]);
    expect(result?.message).toBe(
      'The plan change was applied. The reminder is proposed and has not been applied.',
    );
  });
  it('never infers completion from unknown execution', () => {
    expect(
      reconcileConversationResponse(claimedSuccess, [{ subject: 'action', state: 'unknown' }])
        ?.message,
    ).toBe(
      'I could not confirm whether the action was applied. Its execution status is uncertain.',
    );
  });
  it('leaves non-mutation answers intact and generates rejection even without model prose', () => {
    expect(reconcileConversationResponse(claimedSuccess, [])).toBe(claimedSuccess);
    expect(
      reconcileConversationResponse(null, [{ subject: 'plan', state: 'rejected' }])?.message,
    ).toContain('could not be applied');
  });
});
