import { describe, expect, it } from 'vitest';

import {
  acceptsDispatchClaim,
  acceptsSchedule,
  canScheduleCallbackRetry,
  isCanonicalDispatchGeneration,
  terminalDispatchSettlement,
} from '../../../convex/scheduler_policy.js';

const coordinator = {
  generation: 2,
  state: 'scheduled' as const,
  correlationId: '00000000-0000-4000-8000-000000000003',
  triggerType: 'canonical_job',
  dispatchAttempts: 1,
  maximumDispatchAttempts: 3,
};

describe('Convex opaque scheduler policy', () => {
  it('accepts only the positive integer generations that Neon can authoritatively persist', () => {
    expect(isCanonicalDispatchGeneration(1)).toBe(true);
    expect(isCanonicalDispatchGeneration(2_147_483_647)).toBe(true);
    expect(isCanonicalDispatchGeneration(0)).toBe(false);
    expect(isCanonicalDispatchGeneration(1.5)).toBe(false);
    expect(isCanonicalDispatchGeneration(2_147_483_648)).toBe(false);
  });

  it('accepts a scheduled canonical job once and rejects a duplicate trigger', () => {
    expect(acceptsSchedule(undefined, 1)).toBe(true);
    expect(acceptsSchedule(coordinator, 2)).toBe(false);
  });

  it('rejects a stale trigger and permits an explicit newer generation', () => {
    expect(acceptsSchedule(coordinator, 1)).toBe(false);
    expect(acceptsSchedule(coordinator, 3)).toBe(true);
  });

  it('does not dispatch a cancelled canonical job', () => {
    expect(
      acceptsDispatchClaim(
        { ...coordinator, state: 'cancelled' },
        { generation: 2, correlationId: coordinator.correlationId, triggerType: 'canonical_job' },
      ),
    ).toBe(false);
    expect(acceptsSchedule({ ...coordinator, state: 'cancelled' }, 2)).toBe(false);
  });

  it('requires exact generation/correlation and only schedules bounded retries', () => {
    expect(
      acceptsDispatchClaim(coordinator, {
        generation: 2,
        correlationId: coordinator.correlationId,
        triggerType: 'canonical_job',
      }),
    ).toBe(true);
    expect(
      acceptsDispatchClaim(coordinator, {
        generation: 1,
        correlationId: coordinator.correlationId,
        triggerType: 'canonical_job',
      }),
    ).toBe(false);
    expect(canScheduleCallbackRetry(coordinator)).toBe(true);
    expect(canScheduleCallbackRetry({ ...coordinator, dispatchAttempts: 3 })).toBe(false);
  });

  it('treats duplicate, stale, cancelled, and expired callback outcomes as safe terminal state', () => {
    expect(terminalDispatchSettlement('completed')).toEqual({ state: 'dispatched' });
    expect(terminalDispatchSettlement('already_completed')).toEqual({ state: 'dispatched' });
    expect(terminalDispatchSettlement('stale')).toEqual({ state: 'dispatched' });
    expect(terminalDispatchSettlement('cancelled')).toEqual({ state: 'cancelled' });
    expect(terminalDispatchSettlement('expired')).toEqual({
      state: 'expired',
      lastSafeErrorCategory: 'expired',
    });
    expect(terminalDispatchSettlement('retry_not_allowed')).toEqual({ state: 'dispatched' });
    expect(terminalDispatchSettlement('callback_unconfirmed')).toEqual({
      state: 'failed',
      lastSafeErrorCategory: 'callback_unconfirmed',
    });
  });
});
