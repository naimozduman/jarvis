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

  it('returns the canonical executor disposition on a duplicate authenticated callback', async () => {
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
    expect(run).toHaveBeenNthCalledWith(1, { jobId, correlationId });
    expect(run).toHaveBeenNthCalledWith(2, { jobId, correlationId });
  });
});
