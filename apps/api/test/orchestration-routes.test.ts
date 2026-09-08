import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildApi } from '@jarvis/api';
import type { StatelessCanonicalJobExecutor } from '@jarvis/orchestration';

const jobId = '00000000-0000-4000-8000-000000000001';
const correlationId = '00000000-0000-4000-8000-000000000002';
const callbackSecret = 'convex-to-vercel-test-secret-that-is-not-a-deployment-credential';

describe('Convex-to-Vercel orchestration callback', () => {
  let app: ReturnType<typeof buildApi> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('requires internal callback authentication before it can load a canonical job', async () => {
    const run = vi.fn(async () => ({ disposition: 'completed' as const }));
    app = buildApi({
      environment: { APP_ENV: 'test' },
      orchestration: {
        callbackSecret,
        executor: { run } as unknown as StatelessCanonicalJobExecutor,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/internal/orchestration/jobs/${jobId}/run`,
      payload: { correlationId, triggerType: 'canonical_job', generation: 1 },
    });

    expect(response.statusCode).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('forwards the validated generation unchanged to the canonical executor on duplicate callbacks', async () => {
    const run = vi
      .fn<StatelessCanonicalJobExecutor['run']>()
      .mockResolvedValueOnce({ disposition: 'completed' })
      .mockResolvedValueOnce({ disposition: 'already_completed' });
    app = buildApi({
      environment: { APP_ENV: 'test' },
      orchestration: {
        callbackSecret,
        executor: { run } as unknown as StatelessCanonicalJobExecutor,
      },
    });
    const request = () =>
      app!.inject({
        method: 'POST',
        url: `/internal/orchestration/jobs/${jobId}/run`,
        headers: { authorization: `Bearer ${callbackSecret}` },
        payload: { correlationId, triggerType: 'canonical_job', generation: 1 },
      });

    const first = await request();
    const replay = await request();

    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ disposition: 'completed' });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toEqual({ disposition: 'already_completed' });
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenNthCalledWith(1, { jobId, correlationId, generation: 1 });
    expect(run).toHaveBeenNthCalledWith(2, { jobId, correlationId, generation: 1 });
  });

  it('rejects unversioned or malformed callbacks before it can invoke the executor', async () => {
    const run = vi.fn(async () => ({ disposition: 'completed' as const }));
    app = buildApi({
      environment: { APP_ENV: 'test' },
      orchestration: {
        callbackSecret,
        executor: { run } as unknown as StatelessCanonicalJobExecutor,
      },
    });

    for (const payload of [
      { correlationId, triggerType: 'canonical_job' },
      { correlationId, triggerType: 'canonical_job', generation: 0 },
      { correlationId, triggerType: 'canonical_job', generation: 1.5 },
      { correlationId, triggerType: 'canonical_job', generation: 2_147_483_648 },
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: `/internal/orchestration/jobs/${jobId}/run`,
        headers: { authorization: `Bearer ${callbackSecret}` },
        payload,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'invalid_orchestration_request' });
    }
    expect(run).not.toHaveBeenCalled();
  });

  it('returns a terminal expired disposition without converting it into a retry response', async () => {
    const run = vi
      .fn<StatelessCanonicalJobExecutor['run']>()
      .mockResolvedValue({ disposition: 'expired' });
    app = buildApi({
      environment: { APP_ENV: 'test' },
      orchestration: {
        callbackSecret,
        executor: { run } as unknown as StatelessCanonicalJobExecutor,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/internal/orchestration/jobs/${jobId}/run`,
      headers: { authorization: `Bearer ${callbackSecret}` },
      payload: { correlationId, triggerType: 'canonical_job', generation: 2 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ disposition: 'expired' });
    expect(run).toHaveBeenCalledWith({ jobId, correlationId, generation: 2 });
  });
});
