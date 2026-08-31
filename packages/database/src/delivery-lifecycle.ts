import type { MessagingDeliveryState, OutboundDeliveryIntent } from '@jarvis/contracts';

/**
 * A delivery's freshness policy is persisted alongside the canonical outbox row. It is selected
 * from server-derived intent metadata, never from Convex or a transport callback.
 */
export type OutboundDeliveryFreshnessPolicy =
  'conversation_response' | 'time_sensitive_reminder' | 'critical_alert';

export interface OutboundDeliveryFreshness {
  readonly policy: OutboundDeliveryFreshnessPolicy;
  readonly expiresAt: string;
  readonly maximumAttempts: number;
}

export const localBridgeLeaseDurationMs = 120_000;

const conversationalResponseTtlMs = 24 * 60 * 60 * 1_000;
const timeSensitiveReminderTtlMs = 15 * 60 * 1_000;
const criticalAlertTtlMs = 10 * 60 * 1_000;

/**
 * Normal conversational replies may wait for a reconnect for a day. Reminders and alerts are
 * intentionally shorter-lived: when their window passes, JARVIS records expiry rather than
 * pretending that silence meant completion or sending an obsolete instruction after reconnect.
 */
export function deriveOutboundDeliveryFreshness(
  input: Pick<OutboundDeliveryIntent, 'createdAt' | 'reminderId' | 'critical'>,
): OutboundDeliveryFreshness {
  const createdAt = new Date(input.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error('validation: an outbound delivery requires a valid creation timestamp.');
  }
  if (input.critical) {
    return {
      policy: 'critical_alert',
      expiresAt: new Date(createdAt.getTime() + criticalAlertTtlMs).toISOString(),
      // A critical alert needs an explicit reconciliation/escalation policy after uncertainty;
      // the bridge never keeps trying and cannot turn a stale alert into a late send.
      maximumAttempts: 1,
    };
  }
  if (input.reminderId) {
    return {
      policy: 'time_sensitive_reminder',
      expiresAt: new Date(createdAt.getTime() + timeSensitiveReminderTtlMs).toISOString(),
      maximumAttempts: 2,
    };
  }
  return {
    policy: 'conversation_response',
    expiresAt: new Date(createdAt.getTime() + conversationalResponseTtlMs).toISOString(),
    maximumAttempts: 3,
  };
}

export function isOutboundDeliveryFresh(input: {
  readonly expiresAt: Date | string;
  readonly now: Date;
}): boolean {
  return new Date(input.expiresAt).getTime() > input.now.getTime();
}

export function calculateOutboundDeliveryRetryDelayMs(attemptCount: number): number {
  const initialDelayMs = 5_000;
  return Math.min(15 * 60 * 1_000, initialDelayMs * 2 ** Math.max(0, attemptCount - 1));
}

export type LocalBridgeLeaseEligibility =
  'eligible' | 'expired' | 'lease_expired' | 'already_handled' | 'unavailable';

/**
 * Pure canonical lease policy used by repository responses and provider-free tests. The database
 * still performs the guarded update atomically; this function never grants a lease by itself.
 */
export function evaluateLocalBridgeLeaseEligibility(input: {
  readonly state: MessagingDeliveryState;
  readonly availableAfter: Date | string;
  readonly expiresAt: Date | string;
  readonly attemptCount: number;
  readonly maximumAttempts: number;
  readonly requiresReconciliation: boolean;
  readonly leaseExpiresAt: Date | string | null;
  readonly now: Date;
}): LocalBridgeLeaseEligibility {
  if (!isOutboundDeliveryFresh({ expiresAt: input.expiresAt, now: input.now })) return 'expired';
  if (
    input.state === 'leased' &&
    input.leaseExpiresAt !== null &&
    new Date(input.leaseExpiresAt).getTime() <= input.now.getTime()
  ) {
    return 'lease_expired';
  }
  if (
    input.state === 'sent' ||
    input.state === 'delivered' ||
    input.state === 'read' ||
    input.state === 'failed_terminal'
  ) {
    return 'already_handled';
  }
  if (
    (input.state === 'pending' || input.state === 'failed_retryable') &&
    !input.requiresReconciliation &&
    new Date(input.availableAfter).getTime() <= input.now.getTime() &&
    input.attemptCount < input.maximumAttempts
  ) {
    return 'eligible';
  }
  return 'unavailable';
}
