import { describe, expect, it } from 'vitest';

import { GET } from '@jarvis/web';
import { healthResponseSchema } from '@jarvis/schemas';

describe('web health route skeleton', () => {
  it('returns a provider-free health response', async () => {
    const response = GET();
    const payload = healthResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      service: 'web',
      status: 'ok',
      checks: {
        process: 'pass',
      },
    });
  });
});
