import { describe, expect, it } from 'vitest';

import { resolveWorkerHealthRoute } from '@jarvis/worker';
import { healthResponseSchema } from '@jarvis/contracts';
import { createTestEnvironment } from '@jarvis/testing';

describe('worker health endpoints', () => {
  it('reports liveness without starting jobs or provider clients', () => {
    const response = resolveWorkerHealthRoute('/health/live', {
      environment: createTestEnvironment(),
    });
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
    const response = resolveWorkerHealthRoute('/health/ready', {
      environment: createTestEnvironment(),
    });
    const payload = healthResponseSchema.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(payload.checks).toEqual({
      configuration: 'pass',
      database: 'not_initialized',
      integrations: 'not_initialized',
      queue: 'not_initialized',
      model: 'not_initialized',
    });
  });

  it('returns 503 in production until database, queue, and worker heartbeat are verified', () => {
    const response = resolveWorkerHealthRoute('/health/ready', {
      environment: {
        APP_ENV: 'production',
        APP_URL: 'https://jarvis.example.test',
        API_URL: 'https://api.jarvis.example.test',
        ALLOWED_USER_EMAIL: 'owner@example.test',
        DATABASE_URL: 'postgresql://local.invalid/jarvis',
        ENCRYPTION_KEY_CURRENT: 'development-only-32-character-encryption-key',
      },
    });
    const payload = healthResponseSchema.parse(response.body);

    expect(response.statusCode).toBe(503);
    expect(payload.checks).toMatchObject({ database: 'fail', queue: 'fail' });
  });
});
