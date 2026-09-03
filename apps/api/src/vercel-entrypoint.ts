import type { OutgoingHttpHeaders } from 'node:http';

import type { VercelApiRuntime } from './vercel-runtime.js';
import { createVercelApiRuntime } from './vercel-runtime.js';

export type VercelRuntimeFactory = () => Promise<Pick<VercelApiRuntime, 'app' | 'stop'>>;
export type VercelFetchHandler = (request: Request) => Promise<Response>;

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

function fastifyPath(request: Request): string {
  const url = new URL(request.url);
  // The Vercel Function itself is mounted beneath `/api`; the already-reviewed Fastify routes
  // intentionally retain their canonical paths such as `/health/ready` and `/internal/...`.
  const pathname =
    url.pathname === '/api'
      ? '/'
      : url.pathname.startsWith('/api/')
        ? url.pathname.slice('/api'.length)
        : url.pathname;
  return `${pathname}${url.search}`;
}

function responseHeaders(headers: OutgoingHttpHeaders): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      result.append(name, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        result.append(name, item);
      }
    }
  }
  return result;
}

function unavailableResponse(): Response {
  return Response.json(
    { status: 'unavailable', error: 'The stateless API runtime is unavailable.' },
    {
      status: 503,
      headers: { 'cache-control': 'no-store' },
    },
  );
}

/**
 * Vercel-supported Web-Handler adapter for the existing Fastify API. It deliberately calls
 * Fastify's in-process `inject` interface instead of binding a listener: Vercel owns HTTP,
 * every request uses the reviewed Neon/callback composition, and no worker or durable scheduler
 * can be started by this entrypoint.
 */
export function createVercelFetchHandler(
  createRuntime: VercelRuntimeFactory = createVercelApiRuntime,
): VercelFetchHandler {
  return async (request) => {
    let runtime: Pick<VercelApiRuntime, 'app' | 'stop'> | undefined;
    try {
      runtime = await createRuntime();
      await runtime.app.ready();
      const injection = {
        method: request.method as InjectableHttpMethod,
        url: fastifyPath(request),
        headers: Object.fromEntries(request.headers.entries()),
        ...(request.body ? { payload: Buffer.from(await request.arrayBuffer()) } : {}),
      };
      const response = await runtime.app.inject(injection);
      return new Response(Uint8Array.from(response.rawPayload).buffer, {
        status: response.statusCode,
        headers: responseHeaders(response.headers),
      });
    } catch {
      return unavailableResponse();
    } finally {
      await runtime?.stop().catch(() => undefined);
    }
  };
}

export { fastifyPath };
