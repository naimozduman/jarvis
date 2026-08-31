import { describe, expect, it } from 'vitest';

import {
  calculateOutboundDeliveryRetryDelayMs,
  deriveOutboundDeliveryFreshness,
  evaluateLocalBridgeLeaseEligibility,
  isOutboundDeliveryFresh,
} from '@jarvis/database';

const now = new Date('2026-08-31T12:00:00.000Z');
const base = {
  state: 'pending' as const,
  availableAfter: new Date('2026-08-31T11:59:00.000Z'),
  expiresAt: new Date('2026-08-31T13:00:00.000Z'),
  attemptCount: 0,
  maximumAttempts: 3,
  requiresReconciliation: false,
  leaseExpiresAt: null,
  now,
};

describe('canonical Neon outbound-delivery lifecycle policy', () => {
  it('keeps a normal conversational response eligible longer than a time-sensitive reminder', () => {
    const conversational = deriveOutboundDeliveryFreshness({
      createdAt: now.toISOString(),
      reminderId: null,
      critical: false,
    });
    const reminder = deriveOutboundDeliveryFreshness({
      createdAt: now.toISOString(),
      reminderId: '00000000-0000-4000-8000-000000000031',
      critical: false,
    });
    const critical = deriveOutboundDeliveryFreshness({
      createdAt: now.toISOString(),
      reminderId: '00000000-0000-4000-8000-000000000031',
      critical: true,
    });

    expect(conversational).toMatchObject({ policy: 'conversation_response', maximumAttempts: 3 });
    expect(reminder).toMatchObject({ policy: 'time_sensitive_reminder', maximumAttempts: 2 });
    expect(critical).toMatchObject({ policy: 'critical_alert', maximumAttempts: 1 });
    expect(new Date(conversational.expiresAt).getTime()).toBeGreaterThan(
      new Date(reminder.expiresAt).getTime(),
    );
    expect(new Date(reminder.expiresAt).getTime()).toBeGreaterThan(
      new Date(critical.expiresAt).getTime(),
    );
  });

  it('allows only one Neon lease contender after the canonical row changes to leased', () => {
    expect(evaluateLocalBridgeLeaseEligibility(base)).toBe('eligible');
    expect(
      evaluateLocalBridgeLeaseEligibility({
        ...base,
        state: 'leased',
        leaseExpiresAt: new Date('2026-08-31T12:02:00.000Z'),
      }),
    ).toBe('unavailable');
  });

  it('recovers an expired local-bridge lease as reconciliation-required instead of resending', () => {
    expect(
      evaluateLocalBridgeLeaseEligibility({
        ...base,
        state: 'leased',
        leaseExpiresAt: new Date('2026-08-31T11:59:59.000Z'),
      }),
    ).toBe('lease_expired');
    expect(
      evaluateLocalBridgeLeaseEligibility({
        ...base,
        state: 'failed_retryable',
        requiresReconciliation: true,
      }),
    ).toBe('unavailable');
  });

  it('expires an old outbound delivery rather than sending it after a reconnect', () => {
    const expired = new Date('2026-08-31T11:59:59.000Z');
    expect(isOutboundDeliveryFresh({ expiresAt: expired, now })).toBe(false);
    expect(evaluateLocalBridgeLeaseEligibility({ ...base, expiresAt: expired })).toBe('expired');
  });

  it('uses bounded retry eligibility without inventing a completion from silence', () => {
    expect(calculateOutboundDeliveryRetryDelayMs(1)).toBe(5_000);
    expect(calculateOutboundDeliveryRetryDelayMs(2)).toBe(10_000);
    expect(calculateOutboundDeliveryRetryDelayMs(99)).toBe(15 * 60 * 1_000);
    expect(
      evaluateLocalBridgeLeaseEligibility({
        ...base,
        state: 'failed_retryable',
        availableAfter: new Date('2026-08-31T12:00:05.000Z'),
      }),
    ).toBe('unavailable');
  });
});
