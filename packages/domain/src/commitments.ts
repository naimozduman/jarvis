export type CommitmentState =
  'open' | 'in_progress' | 'completed' | 'cancelled' | 'overdue' | 'deferred';

export interface CommitmentRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly title: string;
  readonly state: CommitmentState;
  readonly followUpState: 'required' | 'waiting' | 'resolved';
  readonly completionEvidenceReference: string | undefined;
  readonly updatedAt: string;
}

export interface CommitmentStatusTransition {
  readonly commitmentId: string;
  readonly nextState: CommitmentState;
  readonly completionEvidenceReference?: string;
  readonly reason: string;
  readonly updatedAt: string;
}

export class CommitmentInvariantError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'CommitmentInvariantError';
  }
}

/**
 * Enforces the product invariant that silence is never completion. A completion transition needs
 * explicit evidence, while a reminder/no-response event leaves the commitment open.
 */
export function applyCommitmentStatusTransition(
  current: CommitmentRecord,
  transition: CommitmentStatusTransition,
): CommitmentRecord {
  if (current.id !== transition.commitmentId) {
    throw new CommitmentInvariantError('The transition targets a different commitment.');
  }

  if (transition.nextState === 'completed' && !transition.completionEvidenceReference?.trim()) {
    throw new CommitmentInvariantError('Completion requires explicit completion evidence.');
  }

  return {
    ...current,
    state: transition.nextState,
    followUpState: transition.nextState === 'completed' ? 'resolved' : current.followUpState,
    completionEvidenceReference:
      transition.nextState === 'completed'
        ? transition.completionEvidenceReference
        : current.completionEvidenceReference,
    updatedAt: transition.updatedAt,
  };
}
