import type { OutgoingHttpHeaders } from 'node:http';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { loadApiEnvironment } from '@jarvis/config';

import { getApiLiveHealth } from './health.js';
import type { VercelApiRuntime } from './vercel-runtime.js';
import { createVercelApiRuntime } from './vercel-runtime.js';

export type VercelRuntimeFactory = () => Promise<Pick<VercelApiRuntime, 'app' | 'stop'>>;

/** The documented HTTP methods accepted by Fastify's in-process injection implementation. */
type InjectableHttpMethod =
  | 'DELETE'
  | 'delete'
  | 'GET'
  | 'get'
  | 'HEAD'
  | 'head'
  | 'PATCH'
  | 'patch'
  | 'POST'
  | 'post'
  | 'PUT'
  | 'put'
  | 'OPTIONS'
  | 'options';

type InjectablePayload = Buffer | Readonly<Record<string, unknown>> | string;

/**
 * Keeps the existing public `/api/*` boundary while the Vercel Fastify entrypoint captures its
 * listener. The inner Fastify application continues to own its canonical route names.
 */
export function fastifyPath(rawUrl: string): string {
  const url = new URL(rawUrl, 'https://jarvis.vercel.invalid');
  const pathname =
    url.pathname === '/api'
      ? '/'
      : url.pathname.startsWith('/api/')
        ? url.pathname.slice('/api'.length)
        : url.pathname;
  return `${pathname}${url.search}`;
}

function applyResponseHeaders(reply: FastifyReply, headers: OutgoingHttpHeaders): void {
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) {
      reply.header(name, value);
    }
  }
}

function requestPayload(request: FastifyRequest): InjectablePayload | undefined {
  if (request.body === undefined) return undefined;
  return request.body as InjectablePayload;
}

function sendUnavailable(reply: FastifyReply): FastifyReply {
  return reply
    .header('cache-control', 'no-store')
    .code(503)
    .send({ status: 'unavailable', error: 'The stateless API runtime is unavailable.' });
}

/**
 * Registers the supported Fastify-backend adapter on Vercel's application entrypoint. The outer
 * app is a route shell only: each `/api/*` invocation composes the canonical Neon runtime,
 * forwards the request in process, and always disposes it. Its entrypoint listener is captured by
 * Vercel; this adapter never starts a worker, timer, or Evolution client.
 */
export function registerVercelFastifyAdapter(
  app: FastifyInstance,
  createRuntime: VercelRuntimeFactory = createVercelApiRuntime,
): FastifyInstance {
  // Liveness proves the Fastify entrypoint and validated non-secret configuration without
  // coupling the probe to a remote dependency. Readiness below remains responsible for Neon.
  app.get('/api/health/live', async (_request, reply) => {
    try {
      loadApiEnvironment(process.env);
      return reply.code(200).send(getApiLiveHealth());
    } catch {
      return sendUnavailable(reply);
    }
  });
  app.all('/api/*', async (request, reply) => {
    let runtime: Pick<VercelApiRuntime, 'app' | 'stop'> | undefined;
    try {
      runtime = await createRuntime();
      await runtime.app.ready();
      const payload = requestPayload(request);
      const response = await runtime.app.inject({
        method: request.method as InjectableHttpMethod,
        url: fastifyPath(request.raw.url ?? request.url),
        headers: request.headers,
        ...(payload === undefined ? {} : { payload }),
      });
      applyResponseHeaders(reply, response.headers);
      return reply.code(response.statusCode).send(response.rawPayload);
    } catch {
      return sendUnavailable(reply);
    } finally {
      await runtime?.stop().catch(() => undefined);
    }
  });
  return app;
}
