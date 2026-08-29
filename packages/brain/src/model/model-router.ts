import type { BrainRequestPurpose, ModelRoute } from '@jarvis/contracts';

export interface ModelRoutingInput {
  readonly purpose: BrainRequestPurpose;
  readonly hasConflict: boolean;
  readonly highConsequence: boolean;
  readonly deepEscalationEnabled: boolean;
  readonly remainingDeepCalls: number;
}

/**
 * Routing is deterministic. A failed deep decision never silently falls back to a cheaper model:
 * that would change the quality profile of a high-consequence decision without user visibility.
 */
export function selectModelRoute(input: ModelRoutingInput): ModelRoute {
  if (input.purpose === 'classification' || input.purpose === 'memory_extraction') {
    return 'fast';
  }

  if (
    input.deepEscalationEnabled &&
    input.remainingDeepCalls > 0 &&
    (input.purpose === 'weekly_review' || input.hasConflict || input.highConsequence)
  ) {
    return 'deep';
  }

  return 'standard';
}
