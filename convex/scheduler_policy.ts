export type CoordinatorJobState =
  'scheduled' | 'dispatching' | 'dispatched' | 'cancelled' | 'expired' | 'failed';

export type CoordinatorDispatchDisposition =
  | 'completed'
  | 'already_completed'
  | 'stale'
  | 'cancelled'
  | 'expired'
  | 'retry_allowed'
  | 'retry_not_allowed'
  | 'callback_unconfirmed';

export interface CoordinatorJobSnapshot {
  readonly generation: number;
  readonly state: CoordinatorJobState;
  readonly correlationId: string;
  readonly triggerType: string;
  readonly dispatchAttempts: number;
  readonly maximumDispatchAttempts: number;
}

/** Matches Neon `integer` storage and the shared canonical generation contract. */
export function isCanonicalDispatchGeneration(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= 2_147_483_647;
}

/** Pure guard shared by the Convex scheduler and provider-free scheduling tests. */
export function acceptsSchedule(
  existing: Pick<CoordinatorJobSnapshot, 'generation' | 'state'> | undefined,
  generation: number,
): boolean {
  // Convex never restarts a cancelled/expired job at the same revision. Only a newer Neon-owned
  // generation may replace a stored opaque coordinator record.
  return !existing || existing.generation < generation;
}

export function acceptsDispatchClaim(
  existing: CoordinatorJobSnapshot | undefined,
  input: Pick<CoordinatorJobSnapshot, 'generation' | 'correlationId' | 'triggerType'>,
): boolean {
  return Boolean(
    existing &&
    existing.generation === input.generation &&
    existing.state === 'scheduled' &&
    existing.correlationId === input.correlationId &&
    existing.triggerType === input.triggerType,
  );
}

export function canScheduleCallbackRetry(
  input: Pick<CoordinatorJobSnapshot, 'dispatchAttempts' | 'maximumDispatchAttempts'>,
): boolean {
  return input.dispatchAttempts < input.maximumDispatchAttempts;
}

/**
 * Maps safe Vercel results to opaque terminal coordinator state. In particular an expired
 * canonical job is terminal and must not re-enter the callback retry path.
 */
export function terminalDispatchSettlement(disposition: CoordinatorDispatchDisposition): {
  readonly state: 'dispatched' | 'cancelled' | 'expired' | 'failed';
  readonly lastSafeErrorCategory?: string;
} {
  if (disposition === 'cancelled') {
    return { state: 'cancelled' };
  }
  if (disposition === 'expired') {
    return { state: 'expired', lastSafeErrorCategory: 'expired' };
  }
  if (disposition === 'callback_unconfirmed') {
    return { state: 'failed', lastSafeErrorCategory: 'callback_unconfirmed' };
  }
  if (disposition === 'retry_allowed') {
    return { state: 'failed', lastSafeErrorCategory: 'callback_retry_missing_timestamp' };
  }
  return { state: 'dispatched' };
}
