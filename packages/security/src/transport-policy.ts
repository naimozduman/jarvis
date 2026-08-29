import type { OutboundDeliveryIntent } from '@jarvis/contracts';

export interface OwnerTransportDeliveryPolicyInput {
  readonly intent: OutboundDeliveryIntent;
  /** Derived by server configuration/connection state, never by a model or webhook body. */
  readonly configuredOwnerTargetReference: string;
  readonly outboundKillSwitchActive: boolean;
  readonly transportConnected: boolean;
  readonly versionVerified: boolean;
  readonly ownerConversationVerified: boolean;
  readonly quietModeActive: boolean;
}

export interface OwnerTransportDeliveryPolicyEvaluation {
  readonly allowed: boolean;
  readonly reason: string;
  readonly matchedRules: readonly string[];
}

/**
 * Narrow, deterministic rule for messages back to the one configured JARVIS owner. This is not a
 * reclassification of `external.message.send`: third-party messaging remains high impact and
 * approval-gated through the existing policy path.
 */
export function evaluateOwnerTransportDelivery(
  input: OwnerTransportDeliveryPolicyInput,
): OwnerTransportDeliveryPolicyEvaluation {
  if (input.intent.targetReference !== input.configuredOwnerTargetReference) {
    return {
      allowed: false,
      reason: 'A transport delivery recipient was not derived from the configured owner target.',
      matchedRules: ['transport.owner-target.required'],
    };
  }
  if (!input.ownerConversationVerified) {
    return {
      allowed: false,
      reason: 'The outbound delivery is not bound to a verified owner conversation.',
      matchedRules: ['transport.owner-conversation.required'],
    };
  }
  if (input.outboundKillSwitchActive) {
    return {
      allowed: false,
      reason: 'The transport outbound kill switch is active.',
      matchedRules: ['transport.outbound-kill-switch'],
    };
  }
  if (!input.versionVerified) {
    return {
      allowed: false,
      reason: 'The transport version-security gate has not been verified.',
      matchedRules: ['transport.version-gate.required'],
    };
  }
  if (!input.transportConnected) {
    return {
      allowed: false,
      reason: 'The transport is not connected; durable work must wait rather than send.',
      matchedRules: ['transport.connection.required'],
    };
  }
  if (input.quietModeActive && !input.intent.critical) {
    return {
      allowed: false,
      reason:
        'Quiet mode suppresses this noncritical delivery without deleting its reminder or commitment.',
      matchedRules: ['transport.quiet-mode.noncritical-suppressed'],
    };
  }
  return {
    allowed: true,
    reason: 'A persisted response/reminder is bound to the verified configured owner transport.',
    matchedRules: ['transport.owner-only.delivery-allowed'],
  };
}
