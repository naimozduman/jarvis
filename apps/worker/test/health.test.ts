import { describe, expect, it } from 'vitest';

import { resolveWorkerHealthRoute } from '@jarvis/worker';
import { healthResponseSchema } from '@jarvis/schemas';

describe('worker health endpoints', () => {
  it('reports liveness without starting jobs or provider clients', () => {
    const response = resolveWorkerHealthRoute('/health/live');
    const payload = healthResponseSchema.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(payload).toMatchObject({
      service: 'worker',
      status: 'ok',
      checks: {
        process: 'pass',
      },
    });
  });

  it('surfaces deferred dependencies rather than claiming queue readiness', () => {
    const response = resolveWorkerHealthRoute('/health/ready');
    const payload = healthResponseSchema.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(payload.checks).toEqual({
      configuration: 'pass',
      database: 'not_initialized',
      integrations: 'not_initialized',
      queue: 'not_initialized',
    });
  });
});
