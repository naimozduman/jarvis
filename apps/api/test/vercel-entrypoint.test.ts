import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import {
  createVercelFetchHandler,
  fastifyPath,
  type VercelRuntimeFactory,
} from '../src/vercel-entrypoint.js';

describe('Vercel Fastify Web-Handler entrypoint', () => {
  it('maps the Vercel /api prefix into the existing Fastify path and disposes the runtime', async () => {
    const inject = vi.fn().mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'set-cookie': ['a=1', 'b=2'] },
      rawPayload: Buffer.from('{"status":"ok"}'),
    });
    const stop = vi.fn().mockResolvedValue(undefined);
    const createRuntime = vi.fn<VercelRuntimeFactory>().mockResolvedValue({
      app: {
        ready: vi.fn().mockResolvedValue(undefined),
        inject,
      },
      stop,
    } as never);
    const handler = createVercelFetchHandler(createRuntime);

    const response = await handler(
      new Request('https://jarvis.example/api/health/ready?probe=1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"probe":true}',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(inject).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/health/ready?probe=1',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
        payload: expect.any(Buffer),
      }),
    );
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('returns a safe unavailable response when stateless composition cannot start', async () => {
    const handler = createVercelFetchHandler(async () => {
      throw new Error('database connection details must not reach the caller');
    });

    const response = await handler(new Request('https://jarvis.example/api/health/live'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unavailable',
      error: 'The stateless API runtime is unavailable.',
    });
  });

  it('never binds a port, starts a worker, or starts Evolution in the Vercel entrypoint path', async () => {
    const [entrypoint, functionSource, composition] = await Promise.all([
      readFile(new URL('../src/vercel-entrypoint.ts', import.meta.url), 'utf8'),
      readFile(new URL('../api/[...route].ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/vercel-runtime.ts', import.meta.url), 'utf8'),
    ]);

    expect(functionSource).toContain('fetch: createVercelFetchHandler()');
    for (const forbidden of [
      '.listen(',
      'PgBoss',
      'createWorkerRuntime',
      'EvolutionClient',
      'setInterval',
      'setTimeout',
      'local-server',
    ]) {
      expect(`${entrypoint}\n${functionSource}\n${composition}`).not.toContain(forbidden);
    }
  });

  it('does not rewrite an already canonical non-/api path', () => {
    expect(fastifyPath(new Request('https://jarvis.example/health/live?full=1'))).toBe(
      '/health/live?full=1',
    );
  });
});
