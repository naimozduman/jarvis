import { describe, expect, it } from 'vitest';

import {
  applyCommitmentStatusTransition,
  CommitmentInvariantError,
  type CommitmentRecord,
} from '@jarvis/domain';

const commitment: CommitmentRecord = {
  id: '00000000-0000-4000-8000-000000000101',
  ownerId: '00000000-0000-4000-8000-000000000001',
  title: 'Finish the schema',
  state: 'open',
  followUpState: 'required',
  completionEvidenceReference: undefined,
  updatedAt: '2026-08-28T12:00:00.000Z',
};

describe('commitment persistence rules', () => {
  it('does not infer completion from no response', () => {
    const stillOpen = applyCommitmentStatusTransition(commitment, {
      commitmentId: commitment.id,
      nextState: 'open',
      reason: 'reminder.no_response',
      updatedAt: '2026-08-28T13:00:00.000Z',
    });

    expect(stillOpen.state).toBe('open');
    expect(stillOpen.followUpState).toBe('required');
  });

  it('requires explicit evidence to complete a commitment', () => {
    expect(() =>
      applyCommitmentStatusTransition(commitment, {
        commitmentId: commitment.id,
        nextState: 'completed',
        reason: 'owner.claim',
        updatedAt: '2026-08-28T13:00:00.000Z',
      }),
    ).toThrow(CommitmentInvariantError);
    expect(
      applyCommitmentStatusTransition(commitment, {
        commitmentId: commitment.id,
        nextState: 'completed',
        completionEvidenceReference: 'owner-confirmation:0001',
        reason: 'owner.confirmed',
        updatedAt: '2026-08-28T13:00:00.000Z',
      }),
    ).toMatchObject({ state: 'completed', followUpState: 'resolved' });
  });
});
