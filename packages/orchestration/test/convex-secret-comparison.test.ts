import { describe, expect, it } from 'vitest';

import { hasValidBearerSecret } from '../../../convex/secret_comparison.js';

describe('Convex HTTP bearer-secret comparison', () => {
  it('accepts an exact bearer secret', async () => {
    await expect(hasValidBearerSecret('test-secret', 'Bearer test-secret')).resolves.toBe(true);
  });

  it.each([
    ['different secret', 'Bearer another-secret'],
    ['missing bearer prefix', 'test-secret'],
    ['missing authorization header', null],
    ['missing configured secret', 'Bearer test-secret'],
  ])('rejects a %s', async (_case, authorization) => {
    await expect(
      hasValidBearerSecret(
        authorization === 'Bearer test-secret' ? undefined : 'test-secret',
        authorization,
      ),
    ).resolves.toBe(false);
  });
});
