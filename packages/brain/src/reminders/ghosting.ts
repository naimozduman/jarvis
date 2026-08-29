import type { GhostingState } from '@jarvis/contracts';

export interface GhostingTransitionInput {
  readonly current: GhostingState;
  readonly reminderCooldownActive: boolean;
  readonly quietModeActive: boolean;
  readonly deadlinePassed: boolean;
  readonly maxFollowUpsReached: boolean;
  readonly validReplanExists: boolean;
  readonly completionEvidencePresent: boolean;
}

/** Silence is input to a follow-up state machine, never implicit completion evidence. */
export function transitionForNoResponse(input: GhostingTransitionInput): GhostingState {
  if (input.completionEvidencePresent) {
    // A caller may resolve the commitment separately only with explicit evidence; this transition
    // intentionally does not return a completion state.
    return 'needs_review';
  }
  if (input.deadlinePassed) {
    return input.validReplanExists ? 'replan_needed' : 'expired_without_completion';
  }
  if (input.quietModeActive || input.reminderCooldownActive) {
    return 'waiting';
  }
  if (input.maxFollowUpsReached) {
    return input.validReplanExists ? 'replan_needed' : 'needs_review';
  }
  if (input.current === 'waiting' || input.current === 'follow_up_scheduled') {
    return 'follow_up_scheduled';
  }
  return 'escalated';
}
