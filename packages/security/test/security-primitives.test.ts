import { describe, expect, it } from 'vitest';

import {
  constantTimeDigestEquals,
  createSafeAuditEvent,
  deriveTokenDigest,
  redactSensitiveFields,
  redactedValue,
} from '@jarvis/security';

describe('security primitives', () => {
  it('redacts nested sensitive data before structured logs or audit persistence', () => {
    expect(
      redactSensitiveFields({
        correlationId: '00000000-0000-4000-8000-000000000001',
        nested: {
          authorization: 'value-not-retained',
          safe: 'visible',
        },
      }),
    ).toEqual({
      correlationId: '00000000-0000-4000-8000-000000000001',
      nested: {
        authorization: redactedValue,
        safe: 'visible',
      },
    });
  });

  it('compares fixed-length HMAC digests in constant time', () => {
    const first = deriveTokenDigest('first-token', 'development-only-test-pepper-32-chars');
    const same = deriveTokenDigest('first-token', 'development-only-test-pepper-32-chars');
    const different = deriveTokenDigest('other-token', 'development-only-test-pepper-32-chars');

    expect(constantTimeDigestEquals(first, same)).toBe(true);
    expect(constantTimeDigestEquals(first, different)).toBe(false);
    expect(constantTimeDigestEquals(first, Buffer.from([0]))).toBe(false);
  });

  it('does not preserve secret-bearing audit metadata', () => {
    const audit = createSafeAuditEvent({
      id: '00000000-0000-4000-8000-000000000005',
      ownerId: '00000000-0000-4000-8000-000000000001',
      actorType: 'system',
      actorId: null,
      action: 'test.mutation',
      targetType: 'test',
      targetId: '00000000-0000-4000-8000-000000000006',
      occurredAt: '2026-08-28T12:00:00.000Z',
      correlationId: '00000000-0000-4000-8000-000000000007',
      previousState: null,
      resultingState: null,
      reason: null,
      source: 'internal',
      metadata: { token: 'value-not-retained', outcome: 'recorded' },
    });

    expect(audit.metadata).toEqual({ token: redactedValue, outcome: 'recorded' });
  });
});
