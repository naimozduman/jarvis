import { describe, expect, it, vi } from 'vitest';
import {
  PersonalAppError,
  PersonalSystemClient,
  type PersonalAppConfiguration,
} from '../src/personal-apps.js';

const token = 'synthetic-owner-system-test-material-only';
const key = '00000000-0000-4000-8000-000000000021';
const config: PersonalAppConfiguration = {
  ourhours: { baseUrl: 'https://hours.example.invalid', token },
  growth: { baseUrl: 'https://growth.example.invalid', token },
  iron: { baseUrl: 'https://iron.example.invalid', token },
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('private owner-system HTTP adapter', () => {
  it('loads daily context from three authenticated sources and preserves structured provenance', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        json({ data: { records: [], origin: new URL(String(url)).origin } }),
      );
    const result = await new PersonalSystemClient(config, { fetch: fetcher }).today({
      date: '2026-09-28',
      timezone: 'America/Chicago',
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result.sources.map((source) => source.sourceApp)).toEqual([
      'ourhours',
      'growth',
      'iron',
    ]);
    for (const [url, init] of fetcher.mock.calls) {
      expect(new URL(String(url)).pathname).toBe('/api/jarvis/today');
      expect(new URL(String(url)).searchParams.get('timezone')).toBe('America/Chicago');
      expect(init).toMatchObject({
        method: 'GET',
        redirect: 'error',
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    expect(result.sources.every((source) => source.status === 'available')).toBe(true);
    expect(JSON.stringify(new PersonalSystemClient(config))).not.toContain(token);
  });
  it('keeps a failed source explicit while returning the healthy sources', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        String(url).includes('iron.')
          ? json({ error: { code: 'revoked', message: token } }, 401)
          : json({ data: [] }),
      );
    const result = await new PersonalSystemClient(config, { fetch: fetcher }).today();
    expect(result.sources[2]).toEqual({
      sourceApp: 'iron',
      status: 'unavailable',
      error: 'unauthorized',
    });
    expect(result.sources[0]?.status).toBe('available');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(result)).not.toContain(token);
  });
  it('retries reads on outage and rate limit with bounded backoff', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({ data: { workouts: [] } }));
    const wait = vi.fn(async () => undefined);
    await expect(
      new PersonalSystemClient(config, { fetch: fetcher, wait }).read('iron', 'workouts'),
    ).resolves.toEqual({ data: { workouts: [] } });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[100], [200]]);
  });
  it('never retries writes and preserves the caller operation key on deliberate replay', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValue(json({ data: { id: key } }));
    const client = new PersonalSystemClient(config, { fetch: fetcher });
    const body = { payload: { title: 'Synthetic event' } };
    await expect(client.writeOurHours('events', 'POST', body, key)).rejects.toMatchObject({
      code: 'unavailable',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await client.writeOurHours('events', 'POST', body, key);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.headers).toMatchObject({ 'Idempotency-Key': key });
      expect(JSON.parse(String(init?.body))).toEqual(body);
    }
  });
  it('routes Growth and Iron writes only to their owning service', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json({ data: {} }));
    const client = new PersonalSystemClient(config, { fetch: fetcher });
    await client.writeGrowth(
      'PATCH',
      {
        id: key,
        expectedVersion: 2,
        input: {
          type: 'water',
          occurredAt: '2026-09-28T12:00:00Z',
          payload: { ml: 250 },
          notes: 'Synthetic correction',
        },
      },
      key,
    );
    await client.saveIronPlan(
      {
        schemaVersion: 1,
        draftId: key,
        kind: 'run',
        createdAt: '2026-09-28T12:00:00Z',
        updatedAt: '2026-09-28T12:00:00Z',
        version: 1,
        template: { kind: 'run', schemaVersion: 1, name: 'Synthetic plan' },
      },
      key,
    );
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      'https://growth.example.invalid/api/jarvis/growth',
    );
    expect(String(fetcher.mock.calls[1]?.[0])).toBe(
      'https://iron.example.invalid/api/jarvis/plans',
    );
  });
  it('uses Iron-specific envelopes with the canonical initial revision', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => json({ data: {} }));
    const client = new PersonalSystemClient(config, { fetch: fetcher });
    const workout = {
      kind: 'run' as const,
      environment: 'outdoor' as const,
      distanceMeters: 1000,
      durationSeconds: 600,
      startedAt: '2026-09-28T12:00:00Z',
      name: 'Synthetic run',
    };
    await client.logIronWorkout(workout, key);
    await client.updateIronWorkout(
      { id: key, expectedVersion: 1, name: 'Correction', notes: null },
      key,
    );
    await client.deleteIronWorkout(key, key);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ workout });
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      id: key,
      expectedVersion: 1,
      name: 'Correction',
      notes: null,
    });
    expect(fetcher.mock.calls[2]?.[1]?.method).toBe('DELETE');
    expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toEqual({ id: key });
    expect(() =>
      client.writeGrowth(
        'POST',
        { input: { type: 'workout', occurredAt: '2026-09-28T12:00:00Z', payload: {} } } as never,
        key,
      ),
    ).toThrow(PersonalAppError);
  });
  it('rejects invalid operations before sending requests', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new PersonalSystemClient(config, { fetch: fetcher });
    expect(() => client.writeOurHours('tasks', 'POST', { payload: {} }, 'invalid')).toThrow(
      PersonalAppError,
    );
    expect(() =>
      client.writeGrowth(
        'PATCH',
        { input: { type: 'water', occurredAt: '2026-09-28T12:00:00Z', payload: { ml: 250 } } },
        key,
      ),
    ).toThrow(PersonalAppError);
    await expect(client.read('growth', 'events')).rejects.toMatchObject({
      code: 'invalid_request',
    });
    expect(() =>
      client.writeOurHours('tasks', 'PATCH', { id: key, expectedVersion: 0, payload: {} }, key),
    ).toThrow(PersonalAppError);
    expect(() =>
      client.writeOurHours(
        'events',
        'POST',
        { payload: {} },
        '00000000-0000-1000-8000-000000000021',
      ),
    ).toThrow(PersonalAppError);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403, 409])('does not retry HTTP %s or echo provider errors', async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        json({ error: { code: 'provider', message: token } }, status),
      );
    const failure = await new PersonalSystemClient(config, { fetch: fetcher })
      .read('ourhours', 'tasks')
      .catch((error) => error);
    expect(failure).toBeInstanceOf(PersonalAppError);
    expect(failure.status).toBe(status);
    expect(failure.message).not.toContain(token);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects redirects, malformed JSON envelopes, HTML, and oversized data', async () => {
    for (const response of [
      new Response(null, { status: 302, headers: { location: 'https://other.example.invalid' } }),
      json({ records: [] }),
      json({ data: {}, error: {} }),
      new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }),
      json({ data: 'x'.repeat(1_048_576) }),
    ]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
      await expect(
        new PersonalSystemClient(config, { fetch: fetcher }).read('iron', 'workouts'),
      ).rejects.toBeInstanceOf(PersonalAppError);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('aborts hanging requests and stops after the configured read budget', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockImplementation(
          async (_url, init) =>
            new Promise((_resolve, reject) =>
              init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
            ),
        );
      const pending = new PersonalSystemClient(config, {
        fetch: fetcher,
        timeoutMs: 100,
        readRetries: 1,
        wait: async () => undefined,
      }).read('iron', 'workouts');
      const rejected = expect(pending).rejects.toMatchObject({ code: 'unavailable' });
      await vi.runAllTimersAsync();
      await rejected;
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it.each([
    'http://hours.example.invalid',
    'https://user:secret@hours.example.invalid',
    'https://hours.example.invalid/path',
    'https://hours.example.invalid?token=secret',
  ])('rejects unsafe origins %s', (baseUrl) => {
    expect(() => new PersonalSystemClient({ ourhours: { baseUrl, token } })).toThrow(
      PersonalAppError,
    );
  });
  it('reports disconnected sources without issuing requests', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await new PersonalSystemClient({}, { fetch: fetcher }).today();
    expect(
      result.sources.every(
        (source) => source.status === 'unavailable' && source.error === 'not_configured',
      ),
    ).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
