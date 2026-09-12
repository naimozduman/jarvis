import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApi } from '@jarvis/api';

import { StagingC7HarnessError } from '../src/staging-c7-harness.js';

const ownerId = '00000000-0000-4000-8000-000000000901';
const stagingToken = 'staging-c7-harness-test-token-not-a-deployment-secret';

describe('staging C.7 lifecycle harness route', () => {
  let app: ReturnType<typeof buildApi> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  function createApp(
    input: {
      readonly appEnvironment?: 'development' | 'staging';
      readonly harnessEnvironment?: 'development' | 'staging';
      runSuite?: () => Promise<unknown>;
    } = {},
  ) {
    app = buildApi({
      environment: {
        APP_ENV: input.appEnvironment ?? 'staging',
        DATABASE_URL: 'postgresql://staging.invalid/jarvis',
      },
      stagingC7Harness: {
        appEnvironment: input.harnessEnvironment ?? input.appEnvironment ?? 'staging',
        ownerId,
        accessToken: stagingToken,
        runSuite: input.runSuite as
          | (() => Promise<{
              readonly passed: true;
              readonly cases: readonly [
                'stale_generation',
                'held_stale_callback',
                'cancellation',
                'rescheduling',
                'expiry',
                'retry_generation',
                'publication_recovery',
              ];
              readonly noActiveSyntheticWork: true;
            }>)
          | undefined,
      },
    });
    return app;
  }

  it('is absent outside staging and cannot be enabled by request data', async () => {
    const runner = vi.fn(async () => ({
      passed: true as const,
      cases: [
        'stale_generation',
        'held_stale_callback',
        'cancellation',
        'rescheduling',
        'expiry',
        'retry_generation',
        'publication_recovery',
      ] as const,
      noActiveSyntheticWork: true as const,
    }));
    const development = createApp({
      appEnvironment: 'development',
      harnessEnvironment: 'staging',
      runSuite: runner,
    });

    const response = await development.inject({
      method: 'POST',
      url: '/internal/staging/c7-lifecycle-suite',
      headers: { authorization: `Bearer ${stagingToken}` },
    });

    expect(response.statusCode).toBe(404);
    expect(runner).not.toHaveBeenCalled();
  });

  it('requires the trusted bearer and rejects all body or query inputs', async () => {
    const runner = vi.fn(async () => ({
      passed: true as const,
      cases: [
        'stale_generation',
        'held_stale_callback',
        'cancellation',
        'rescheduling',
        'expiry',
        'retry_generation',
        'publication_recovery',
      ] as const,
      noActiveSyntheticWork: true as const,
    }));
    const staging = createApp({ runSuite: runner });

    const unauthenticated = await staging.inject({
      method: 'POST',
      url: '/internal/staging/c7-lifecycle-suite',
    });
    const ownerInjection = await staging.inject({
      method: 'POST',
      url: '/internal/staging/c7-lifecycle-suite',
      headers: { authorization: `Bearer ${stagingToken}` },
      payload: { ownerId: '00000000-0000-4000-8000-000000000999' },
    });
    const queryInjection = await staging.inject({
      method: 'POST',
      url: '/internal/staging/c7-lifecycle-suite?case=expiry',
      headers: { authorization: `Bearer ${stagingToken}` },
    });
    const accepted = await staging.inject({
      method: 'POST',
      url: '/internal/staging/c7-lifecycle-suite',
      headers: { authorization: `Bearer ${stagingToken}` },
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(ownerInjection.statusCode).toBe(400);
    expect(queryInjection.statusCode).toBe(400);
    expect(accepted.statusCode).toBe(200);
    expect(JSON.parse(accepted.payload)).toMatchObject({
      passed: true,
      noActiveSyntheticWork: true,
    });
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it('returns only safe fixed failure categories to an authenticated operator', async () => {
    const staging = createApp({
      runSuite: async () => {
        throw new StagingC7HarnessError('assertion_failed', 'held_stale_callback');
      },
    });

    const response = await staging.inject({
      method: 'POST',
      url: '/internal/staging/c7-lifecycle-suite',
      headers: { authorization: `Bearer ${stagingToken}` },
    });

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.payload)).toEqual({
      error: 'assertion_failed',
      case: 'held_stale_callback',
    });
    expect(response.payload).not.toContain('postgresql://');
  });
});
