import type { OutgoingHttpHeaders } from 'node:http';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getVercelOidcToken } from '@vercel/oidc';

import { loadApiEnvironment } from '@jarvis/config';
import { createSafeLogRecord } from '@jarvis/observability';

import { getApiLiveHealth } from './health.js';
import type { VercelApiRuntime, VercelInvocationIdentity } from './vercel-runtime.js';
import { createVercelApiRuntime } from './vercel-runtime.js';
import { recordTelegramTiming, withTelegramTiming } from './telegram-timing.js';

export type VercelRuntimeFactory = (
  identity: VercelInvocationIdentity,
) => Promise<Pick<VercelApiRuntime, 'app' | 'stop'>>;
export type VercelInvocationIdentityResolver = () => Promise<VercelInvocationIdentity>;

/**
 * Resolves a fresh platform identity for this invocation. Absence is a supported state: the API
 * still composes, while model readiness remains `not_configured` and no provider call is possible.
 */
export async function resolveVercelInvocationIdentity(): Promise<VercelInvocationIdentity> {
  // `@vercel/oidc` can obtain a development token for a locally linked project. Local and test
  // processes must remain provider-free unless they inject an explicit resolver test double.
  if (process.env.VERCEL !== '1') return {};
  try {
    const oidcToken = await getVercelOidcToken();
    return oidcToken ? { oidcToken } : {};
  } catch {
    return {};
  }
}

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

/**
 * The outer Vercel Fastify shell has already parsed the provider request body. Passing its wire
 * framing headers into `inject` alongside that parsed payload can leave the inner Fastify parser
 * waiting for bytes that have already been consumed. Retain semantic/authentication headers only;
 * light-my-request supplies correct framing for the re-serialized payload.
 */
function forwardedHeaders(headers: FastifyRequest['headers']): FastifyRequest['headers'] {
  const consumedFramingHeaders = new Set([
    'content-length',
    'transfer-encoding',
    'content-encoding',
    'connection',
  ]);
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !consumedFramingHeaders.has(name.toLowerCase())),
  ) as FastifyRequest['headers'];
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
  resolveIdentity: VercelInvocationIdentityResolver = resolveVercelInvocationIdentity,
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
  app.all('/api/*', async (request, reply) =>
    withTelegramTiming(async () => {
      let runtime: Pick<VercelApiRuntime, 'app' | 'stop'> | undefined;
      const telegramWebhook = fastifyPath(request.raw.url ?? request.url) === '/webhooks/telegram';
      if (telegramWebhook) recordTelegramTiming('webhook_received');
      try {
        const identity = await resolveIdentity();
        runtime = await createRuntime(identity);
        await runtime.app.ready();
        if (telegramWebhook) {
          console.info(
            JSON.stringify(
              createSafeLogRecord('telegram.webhook.adapter.progress', { stage: 'inner_ready' }),
            ),
          );
        }
        const payload = requestPayload(request);
        const response = await runtime.app.inject({
          method: request.method as InjectableHttpMethod,
          url: fastifyPath(request.raw.url ?? request.url),
          headers: forwardedHeaders(request.headers),
          ...(payload === undefined ? {} : { payload }),
        });
        if (telegramWebhook) {
          console.info(
            JSON.stringify(
              createSafeLogRecord('telegram.webhook.adapter.progress', {
                stage: 'inner_response',
                statusCode: response.statusCode,
              }),
            ),
          );
        }
        applyResponseHeaders(reply, response.headers);
        return reply.code(response.statusCode).send(response.rawPayload);
      } catch {
        if (telegramWebhook) {
          console.info(
            JSON.stringify(
              createSafeLogRecord('telegram.webhook.adapter.rejected', {
                category: 'inner_runtime_unavailable',
              }),
            ),
          );
        }
        return sendUnavailable(reply);
      } finally {
        await runtime?.stop().catch(() => undefined);
      }
    }),
  );
  return app;
}
