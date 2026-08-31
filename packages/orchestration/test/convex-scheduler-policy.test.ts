import { describe, expect, it } from 'vitest';

import {
  acceptsDispatchClaim,
  acceptsSchedule,
  canScheduleCallbackRetry,
} from '../../../convex/scheduler-policy.js';

const coordinator = {
  generation: 2,
  state: 'scheduled' as const,
  correlationId: '00000000-0000-4000-8000-000000000003',
  triggerType: 'canonical_job',
  dispatchAttempts: 1,
  maximumDispatchAttempts: 3,
};

describe('Convex opaque scheduler policy', () => {
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
});
