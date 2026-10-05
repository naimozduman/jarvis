export type AccountabilityOutcomeKind =
  | 'continue_original_plan'
  | 'move_within_same_day'
  | 'reduce_to_minimum_viable_action'
  | 'swap_blocks'
  | 'move_to_next_protected_slot'
  | 'ask_one_clarification'
  | 'accept_explicit_hard_override'
  | 'escalate_reminder'
  | 'record_miss_and_create_recovery_plan';

export interface AccountabilityInput {
  readonly importance: number;
  readonly constitutionalRelevance: number;
  readonly deadlineMinutes: number | null;
  readonly remainingMinutes: number;
  readonly consequence: string | null;
  readonly minimumAcceptableVersion: string | null;
  readonly minimumMinutes: number | null;
  readonly dependenciesMet: boolean;
  readonly previousMisses: number;
  readonly alternateWindowsToday: number;
  readonly nextProtectedWindowExists: boolean;
  readonly explicitOwnerIntent: string | null;
  readonly hardOverrideActive: boolean;
  readonly ambiguityMatters: boolean;
  /** Canonical episode history supplied by the caller; repetition cannot grant another challenge. */
  readonly alreadyChallenged?: boolean;
}

export interface AccountabilityOutcome {
  readonly kind: AccountabilityOutcomeKind;
  readonly rationale: string;
  readonly challengeLevel: 'none' | 'gentle' | 'direct';
  readonly nextAction: string;
}

/** Deterministic first-pass accountability; a model may help word or contextualize the result. */
export class AccountabilityEngine {
  public evaluate(input: AccountabilityInput): AccountabilityOutcome {
    const challenge = (level: AccountabilityOutcome['challengeLevel']) =>
      input.alreadyChallenged ? 'none' : level;
    if (input.hardOverrideActive) {
      return {
        kind: 'accept_explicit_hard_override',
        rationale: 'An explicit, active owner override outranks preferences and model hypotheses.',
        challengeLevel: 'none',
        nextAction: 'Record the override consequence once and preserve the underlying commitment.',
      };
    }
    if (input.ambiguityMatters) {
      return {
        kind: 'ask_one_clarification',
        rationale: 'A missing fact would materially alter the available plan.',
        challengeLevel: challenge('gentle'),
        nextAction: 'Ask one concise question before changing the plan.',
      };
    }
    if (!input.dependenciesMet) {
      return {
        kind: input.nextProtectedWindowExists
          ? 'move_to_next_protected_slot'
          : 'ask_one_clarification',
        rationale:
          'A required dependency is not complete, so continuing the current block is invalid.',
        challengeLevel: challenge('gentle'),
        nextAction: input.nextProtectedWindowExists
          ? 'Protect the next valid window rather than deleting the commitment.'
          : 'Ask which dependency or constraint should take precedence.',
      };
    }
    if (input.deadlineMinutes !== null && input.deadlineMinutes <= 0) {
      return {
        kind: 'record_miss_and_create_recovery_plan',
        rationale:
          'The deadline has passed without completion evidence; silence is not completion.',
        challengeLevel: challenge('direct'),
        nextAction: 'Keep the commitment open, record the miss, and create a recovery option.',
      };
    }
    const viableMinutes =
      input.deadlineMinutes === null
        ? input.remainingMinutes
        : Math.min(input.remainingMinutes, input.deadlineMinutes);
    if (input.minimumMinutes !== null && viableMinutes >= input.minimumMinutes) {
      if (viableMinutes < Math.max(input.minimumMinutes * 2, 30)) {
        return {
          kind: 'reduce_to_minimum_viable_action',
          rationale:
            'There is enough time for the minimum acceptable version but not the full plan.',
          challengeLevel: challenge(input.constitutionalRelevance >= 60 ? 'direct' : 'gentle'),
          nextAction:
            input.minimumAcceptableVersion ?? 'Do the smallest meaningful next physical action.',
        };
      }
      return {
        kind: 'continue_original_plan',
        rationale:
          'The remaining time supports the current commitment and no stronger constraint is known.',
        challengeLevel: challenge(input.constitutionalRelevance >= 70 ? 'direct' : 'gentle'),
        nextAction: 'Start the next concrete step now.',
      };
    }
    if (input.alternateWindowsToday > 0) {
      return {
        kind: 'move_within_same_day',
        rationale:
          'A valid same-day alternative exists, so the commitment does not need to be dropped.',
        challengeLevel: challenge(input.importance >= 70 ? 'direct' : 'gentle'),
        nextAction: 'Choose the nearest protected same-day slot.',
      };
    }
    if (input.nextProtectedWindowExists) {
      return {
        kind: 'move_to_next_protected_slot',
        rationale: 'No valid same-day window remains, but a protected recovery slot exists.',
        challengeLevel: challenge(input.previousMisses >= 2 ? 'direct' : 'gentle'),
        nextAction: 'Move the commitment to the next protected valid slot and state the tradeoff.',
      };
    }
    return {
      kind:
        input.previousMisses >= 2 ? 'escalate_reminder' : 'record_miss_and_create_recovery_plan',
      rationale:
        'No valid execution window is known; the commitment remains open and needs recovery.',
      challengeLevel: challenge(input.previousMisses >= 2 ? 'direct' : 'gentle'),
      nextAction:
        input.previousMisses >= 2
          ? 'Use a different, bounded reminder or intervention strategy.'
          : 'Record the miss without rewriting the goal and create a recovery plan.',
    };
  }
}
