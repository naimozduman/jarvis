import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { OutboundDeliveryIntent } from '@jarvis/contracts';
import {
  evaluateOwnerTransportDelivery,
  type OwnerTransportDeliveryPolicyInput,
} from '@jarvis/security';

const ownerId = '00000000-0000-4000-8000-000000000001';
const targetReference = `evo:owner-target:${createHash('sha256')
  .update('owner-target:15551234567', 'utf8')
  .digest('hex')}`;

function intent(overrides: Partial<OutboundDeliveryIntent> = {}): OutboundDeliveryIntent {
  return {
    id: '00000000-0000-4000-8000-000000000011',
    ownerId,
    messageId: '00000000-0000-4000-8000-000000000012',
    conversationId: '00000000-0000-4000-8000-000000000013',
    connectionId: '00000000-0000-4000-8000-000000000014',
    transport: 'evolution_whatsapp',
    targetReference,
    operationKey:
      'transport:owner-response:00000000-0000-4000-8000-000000000014:00000000-0000-4000-8000-000000000012',
    contentType: 'text',
    content: 'A persisted owner response.',
    mediaObjectReference: null,
    sourceEventId: null,
    brainRequestId: null,
    reminderId: null,
    critical: false,
    correlationId: '00000000-0000-4000-8000-000000000015',
    causationId: null,
    createdAt: '2026-08-29T12:00:00.000Z',
    ...overrides,
  };
}

function evaluate(overrides: Partial<OwnerTransportDeliveryPolicyInput> = {}) {
  return evaluateOwnerTransportDelivery({
    intent: intent(),
    configuredOwnerTargetReference: targetReference,
    outboundKillSwitchActive: false,
    transportConnected: true,
    versionVerified: true,
    ownerConversationVerified: true,
    quietModeActive: false,
    ...overrides,
  });
}

describe('owner-only transport delivery policy', () => {
  it('allows only verified, version-gated, connected owner traffic', () => {
    expect(evaluate()).toMatchObject({ allowed: true });
    expect(evaluate({ versionVerified: false })).toMatchObject({
      allowed: false,
      matchedRules: ['transport.version-gate.required'],
    });
    expect(evaluate({ transportConnected: false })).toMatchObject({
      allowed: false,
      matchedRules: ['transport.connection.required'],
    });
    expect(evaluate({ ownerConversationVerified: false })).toMatchObject({
      allowed: false,
      matchedRules: ['transport.owner-conversation.required'],
    });
  });

  it('never sends to a model-selected recipient, honors kill switch/quiet mode, and preserves critical bypass', () => {
    expect(
      evaluate({ intent: intent({ targetReference: 'evolution-owner:unknown-target-reference' }) }),
    ).toMatchObject({ allowed: false, matchedRules: ['transport.owner-target.required'] });
    expect(evaluate({ outboundKillSwitchActive: true })).toMatchObject({
      allowed: false,
      matchedRules: ['transport.outbound-kill-switch'],
    });
    expect(evaluate({ quietModeActive: true })).toMatchObject({
      allowed: false,
      matchedRules: ['transport.quiet-mode.noncritical-suppressed'],
    });
    expect(evaluate({ quietModeActive: true, intent: intent({ critical: true }) })).toMatchObject({
      allowed: true,
    });
  });
});
