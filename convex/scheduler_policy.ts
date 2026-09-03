export type CoordinatorJobState =
  'scheduled' | 'dispatching' | 'dispatched' | 'cancelled' | 'failed';

export interface CoordinatorJobSnapshot {
  readonly generation: number;
  readonly state: CoordinatorJobState;
  readonly correlationId: string;
  readonly triggerType: string;
  readonly dispatchAttempts: number;
  readonly maximumDispatchAttempts: number;
}

/** Pure guard shared by the Convex scheduler and provider-free scheduling tests. */
export function acceptsSchedule(
  existing: Pick<CoordinatorJobSnapshot, 'generation' | 'state'> | undefined,
  generation: number,
): boolean {
  return !existing || existing.state === 'cancelled' || existing.generation < generation;
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
