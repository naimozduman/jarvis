import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApi } from '@jarvis/api';
import { PersonalSystemClient } from '@jarvis/integrations';
import type { PersonalSystemRouteDependencies } from '../src/personal-system-routes.js';
const readToken = 'synthetic-personal-system-reader-credential';
const nextReadToken = 'synthetic-next-personal-system-reader-credential';
const ownerId = '00000000-0000-4000-8000-000000000001';
const serviceToken = 'synthetic-private-downstream-service-credential';

describe('private personal-system read gateway', () => {
  let app: ReturnType<typeof buildApi> | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });
  function setup(overrides: Partial<PersonalSystemRouteDependencies> = {}) {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ data: { events: [], workouts: [] } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const client = new PersonalSystemClient(
      {
        ourhours: { baseUrl: 'https://hours.example.invalid', token: serviceToken },
        growth: { baseUrl: 'https://growth.example.invalid', token: serviceToken },
        iron: { baseUrl: 'https://iron.example.invalid', token: serviceToken },
      },
      { fetch: fetcher },
    );
    const admit = vi.fn(async () => true);
    const logRejection = vi.fn();
    const dependencies = {
      readToken,
      nextReadToken,
      today: (query: Readonly<Record<string, string>>) => client.today(query),
      status: async () => [],
      admit,
      logRejection,
      ...overrides,
    };
    app = buildApi({
      environment: { APP_ENV: 'test', JARVIS_OWNER_ID: ownerId },
      personalSystem: dependencies,
    });
    return { fetcher, admit, logRejection };
  }
  it('authenticates before audit admission or three downstream credentialed reads', async () => {
    const { fetcher, admit, logRejection } = setup();
    for (const authorization of [
      undefined,
      'Bearer invalid',
      'Bearer wrong-bridge',
      `Bearer ${serviceToken}`,
    ]) {
      const response = await app!.inject({
        url: '/personal-system/today',
        ...(authorization ? { headers: { authorization } } : {}),
      });
      expect(response.statusCode).toBe(401);
      expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(admit).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(logRejection).toHaveBeenCalledTimes(4);
    expect(JSON.stringify(logRejection.mock.calls)).not.toContain(serviceToken);
  });
  it('executes the authenticated aggregate with outgoing app credentials and metadata audit', async () => {
    const { fetcher, admit } = setup();
    const response = await app!.inject({
      url: '/personal-system/today?date=2026-09-28&timezone=America%2FChicago',
      headers: { authorization: `Bearer ${readToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      schemaVersion: 1,
      permissions: ['personal-system.read'],
    });
    expect(response.json().data.sources).toHaveLength(3);
    expect(admit).toHaveBeenCalledWith('today', 'current');
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const [, init] of fetcher.mock.calls)
      expect(init?.headers).toMatchObject({ Authorization: `Bearer ${serviceToken}` });
    expect(response.body).not.toContain(serviceToken);
    expect(response.body).not.toContain(readToken);
  });
  it('supports overlap rotation and rejects the removed old credential', async () => {
    setup({ readToken: nextReadToken, nextReadToken });
    const rejected = await app!.inject({
      url: '/personal-system/status',
      headers: { authorization: `Bearer ${readToken}` },
    });
    const accepted = await app!.inject({
      url: '/personal-system/status',
      headers: { authorization: `Bearer ${nextReadToken}` },
    });
    expect(rejected.statusCode).toBe(401);
    expect(accepted.statusCode).toBe(200);
  });
  it('admits the next credential during rotation without changing permission', async () => {
    const { admit } = setup();
    const response = await app!.inject({
      url: '/personal-system/status',
      headers: { authorization: `Bearer ${nextReadToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(admit).toHaveBeenCalledWith('status', 'next');
    expect(response.json().permissions).toEqual(['personal-system.read']);
  });
  it('enforces canonical rate limiting before outgoing service calls', async () => {
    const { fetcher } = setup({ admit: async () => false });
    const response = await app!.inject({
      url: '/personal-system/today',
      headers: { authorization: `Bearer ${readToken}` },
    });
    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('60');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('fails closed if canonical audit admission fails and sanitizes failures', async () => {
    const { fetcher } = setup({
      admit: async () => {
        throw new Error(serviceToken);
      },
    });
    const response = await app!.inject({
      url: '/personal-system/today',
      headers: { authorization: `Bearer ${readToken}` },
    });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain(serviceToken);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects untrusted targets and invalid dates before any reads', async () => {
    const { fetcher, admit } = setup();
    for (const query of [
      'url=https://other.example.invalid',
      'date=2026-02-31',
      'timezone=Invalid/Zone',
      'ownerId=another-owner',
    ]) {
      const response = await app!.inject({
        url: `/personal-system/today?${query}`,
        headers: { authorization: `Bearer ${readToken}` },
      });
      expect(response.statusCode).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(admit).not.toHaveBeenCalled();
  });
  it('has no write endpoint and remains absent without dedicated configuration', async () => {
    setup();
    expect(
      (
        await app!.inject({
          method: 'POST',
          url: '/personal-system/today',
          headers: { authorization: `Bearer ${readToken}` },
        })
      ).statusCode,
    ).toBe(404);
    await app!.close();
    app = buildApi({ environment: { APP_ENV: 'test' } });
    expect((await app.inject({ url: '/personal-system/today' })).statusCode).toBe(404);
  });
});
