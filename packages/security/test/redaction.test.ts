import { describe, expect, it } from 'vitest';

import { redactSensitiveFields, redactedValue } from '@jarvis/security';

describe('redactSensitiveFields', () => {
  it('redacts sensitive field names while preserving safe operational metadata', () => {
    expect(
      redactSensitiveFields({
        correlationId: '00000000-0000-4000-8000-000000000000',
        latencyMs: 12,
        authorization: 'phase0-secret-value',
      }),
    ).toEqual({
      correlationId: '00000000-0000-4000-8000-000000000000',
      latencyMs: 12,
      authorization: redactedValue,
    });
  });
});
