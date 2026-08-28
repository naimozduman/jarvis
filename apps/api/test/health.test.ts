import { afterEach, describe, expect, it } from 'vitest';

import type { FastifyInstance } from 'fastify';

import { buildApi } from '@jarvis/api';
import { healthResponseSchema } from '@jarvis/contracts';
import { createTestEnvironment } from '@jarvis/testing';

describe('API health endpoints', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('boots in test mode without provider credentials and reports liveness', async () => {
    app = buildApi({
      environment: createTestEnvironment(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });
    const payload = healthResponseSchema.parse(JSON.parse(response.payload));

    expect(response.statusCode).toBe(200);
    expect(payload).toMatchObject({
      service: 'api',
      status: 'ok',
      checks: {
        process: 'pass',
      },
    });
  });

  it('makes deferred database and queue dependencies explicit in readiness', async () => {
    app = buildApi({
      environment: createTestEnvironment(),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });
    const payload = healthResponseSchema.parse(JSON.parse(response.payload));

    expect(response.statusCode).toBe(200);
    expect(payload.checks).toEqual({
      configuration: 'pass',
      database: 'not_initialized',
      queue: 'not_initialized',
    });
  });

  it('fails production readiness until durable dependencies are verified', async () => {
    app = buildApi({
      environment: {
        APP_ENV: 'production',
        APP_URL: 'https://jarvis.example.test',
        API_URL: 'https://api.jarvis.example.test',
        ALLOWED_USER_EMAIL: 'owner@example.test',
        DATABASE_URL: 'postgresql://local.invalid/jarvis',
        ENCRYPTION_KEY_CURRENT: 'development-only-32-character-encryption-key',
      },
    });

    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    const payload = healthResponseSchema.parse(JSON.parse(response.payload));

    expect(response.statusCode).toBe(503);
    expect(payload).toMatchObject({
      status: 'not_ready',
      checks: { database: 'fail', queue: 'fail' },
    });
  });
});
