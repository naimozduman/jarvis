import { access, readFile } from 'node:fs/promises';

import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import {
  fastifyPath,
  registerVercelFastifyAdapter,
  type VercelRuntimeFactory,
} from '../src/vercel-entrypoint.js';

describe('Vercel Fastify application entrypoint', () => {
  it('maps the public /api readiness path into the existing Fastify path and disposes the runtime', async () => {
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
    const app = Fastify({ logger: false });
    registerVercelFastifyAdapter(app, createRuntime);

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/health/ready?probe=1',
        headers: { 'content-type': 'application/json' },
        payload: '{"probe":true}',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
      expect(inject).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/health/ready?probe=1',
          headers: expect.objectContaining({ 'content-type': 'application/json' }),
          payload: { probe: true },
        }),
      );
      expect(stop).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('serves liveness after configuration validation without composing a database runtime', async () => {
    const createRuntime = vi.fn<VercelRuntimeFactory>();
    const app = Fastify({ logger: false });
    registerVercelFastifyAdapter(app, createRuntime);

    try {
      const response = await app.inject({ method: 'GET', url: '/api/health/live' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ service: 'api', status: 'ok' });
      expect(createRuntime).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('keeps root and unprefixed health paths outside the canonical runtime', async () => {
    const createRuntime = vi.fn<VercelRuntimeFactory>();
    const app = Fastify({ logger: false });
    registerVercelFastifyAdapter(app, createRuntime);

    try {
      const [root, unprefixedLive, publicLive] = await Promise.all([
        app.inject({ method: 'GET', url: '/' }),
        app.inject({ method: 'GET', url: '/health/live' }),
        app.inject({ method: 'GET', url: '/api/health/live' }),
      ]);

      expect(root.statusCode).toBe(404);
      expect(unprefixedLive.statusCode).toBe(404);
      expect(publicLive.statusCode).toBe(200);
      expect(createRuntime).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('returns a safe unavailable response when stateless readiness composition cannot start', async () => {
    const app = Fastify({ logger: false });
    registerVercelFastifyAdapter(app, async () => {
      throw new Error('database connection details must not reach the caller');
    });

    try {
      const response = await app.inject({ method: 'GET', url: '/api/health/ready' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({
        status: 'unavailable',
        error: 'The stateless API runtime is unavailable.',
      });
    } finally {
      await app.close();
    }
  });

  it('has one Vercel Fastify entrypoint and only starts the listener Vercel captures', async () => {
    const candidates = [
      '../app.ts',
      '../index.ts',
      '../server.ts',
      '../src/app.ts',
      '../src/index.ts',
      '../src/server.ts',
    ] as const;
    const [entrypoint, serverSource, composition, tsconfigSource, presentCandidates] =
      await Promise.all([
        readFile(new URL('../src/vercel-entrypoint.ts', import.meta.url), 'utf8'),
        readFile(new URL('../server.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/vercel-runtime.ts', import.meta.url), 'utf8'),
        readFile(new URL('../tsconfig.json', import.meta.url), 'utf8'),
        Promise.all(
          candidates.map(async (candidate) => {
            try {
              await access(new URL(candidate, import.meta.url));
              return candidate;
            } catch {
              return undefined;
            }
          }),
        ),
      ]);

    const existingCandidates = presentCandidates.filter(
      (candidate): candidate is (typeof candidates)[number] => candidate !== undefined,
    );
    const fastifyEntrypoints = await Promise.all(
      existingCandidates.map(async (candidate) => {
        const source = await readFile(new URL(candidate, import.meta.url), 'utf8');
        return /(?:from|require|import)\s*(?:\(\s*)?['"]fastify['"]\s*(?:\))?/.test(source)
          ? candidate
          : undefined;
      }),
    );

    expect(fastifyEntrypoints.filter((candidate) => candidate !== undefined)).toEqual([
      '../server.ts',
    ]);
    expect(serverSource).toContain("import Fastify from 'fastify';");
    expect(serverSource).toContain('registerVercelFastifyAdapter(app);');
    expect(serverSource).toContain('void app.listen({ port: 3000 });');
    expect(serverSource).not.toContain('export default');
    expect(entrypoint).toContain("app.all('/api/*'");
    const apiTsconfig = JSON.parse(tsconfigSource) as {
      readonly compilerOptions?: { readonly paths?: unknown };
    };
    expect(apiTsconfig.compilerOptions?.paths).toEqual({});
    for (const forbidden of [
      'PgBoss',
      'createWorkerRuntime',
      'EvolutionClient',
      'setInterval',
      'setTimeout',
      'local-server',
    ]) {
      expect(`${entrypoint}\n${serverSource}`).not.toContain(forbidden);
    }
    expect(composition).not.toContain('.listen(');
  });

  it('strips the public API prefix exactly once', () => {
    expect(fastifyPath('/api/health/live?full=1')).toBe('/health/live?full=1');
    expect(fastifyPath('/api/api/health/live?full=1')).toBe('/api/health/live?full=1');
  });

  it('does not rewrite an already canonical non-/api path', () => {
    expect(fastifyPath('/health/live?full=1')).toBe('/health/live?full=1');
  });
});
