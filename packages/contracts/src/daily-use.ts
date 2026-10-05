/** Bounded owner evidence, not model-authored personality or authority. */
export interface OwnerTurnFeedback {
  readonly category: 'brevity' | 'tone' | 'challenge' | 'positive' | 'meaning' | 'mode' | 'rule';
  readonly scope: 'one_turn' | 'explicit_owner_preference' | 'constitution_candidate';
  readonly directive: string;
  readonly quote: string;
}

export interface RecordedOwnerFeedback {
  readonly candidateId: string;
  readonly targetDecisionId: string | null;
  readonly targetResponseId: string | null;
  readonly scope: OwnerTurnFeedback['scope'];
  readonly repeatedEvidenceCount: number;
}

/** Read from canonical commitments/plans; unknown constraints stay unknown. */
export interface DailyUseCommitment {
  readonly id: string;
  readonly title: string;
  readonly importance: number;
  readonly consequence: string | null;
  readonly minimumAcceptableVersion: string | null;
  readonly minimumMinutes: number | null;
  readonly deadlineMinutes: number | null;
  readonly remainingMinutes: number;
  readonly constraintsKnown: boolean;
  readonly dependenciesMet: boolean;
  readonly alternateWindowsToday: number;
  readonly nextProtectedWindowExists: boolean;
  readonly alreadyChallenged: boolean;
  readonly hardOverrideActive: boolean;
  readonly overrideConsequenceExplained?: boolean;
}
