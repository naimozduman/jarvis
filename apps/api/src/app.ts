import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { loadApiEnvironment } from '@jarvis/config';
import type { EnvironmentSource } from '@jarvis/config';
import type { MessagingTransportHealth } from '@jarvis/contracts';

import { getApiLiveHealth, getApiReadinessHealth } from './health.js';
import {
  registerEvolutionWebhookRoute,
  type EvolutionWebhookIngressDependencies,
} from './evolution-webhook.js';

export interface BuildApiOptions {
  readonly environment?: EnvironmentSource;
  readonly readiness?: {
    readonly databaseVerified?: boolean;
    readonly queueStarted?: boolean;
  };
  /** Explicit composition only; disabled/default API instances never call Evolution. */
  readonly evolutionWebhook?: EvolutionWebhookIngressDependencies;
  /** Transport health is informational and separate from core API readiness. */
  readonly evolutionTransportHealth?: () => Promise<MessagingTransportHealth>;
}

export function buildApi(options: BuildApiOptions = {}): FastifyInstance {
  const environment = loadApiEnvironment(options.environment ?? process.env);

  const app = Fastify({
    logger: false,
  });

  app.get('/health/live', async () => getApiLiveHealth());
  app.get('/health/ready', async (request, reply) => {
    const health = getApiReadinessHealth(environment, options.readiness);
    return reply.code(health.status === 'ok' ? 200 : 503).send(health);
  });
  app.get('/health/transport/evolution', async (_request, reply) => {
    const health =
      (await options.evolutionTransportHealth?.()) ??
      ({
        transport: 'evolution_whatsapp' as const,
        configured: false,
        versionVerified: false,
        reachable: false,
        authenticated: false,
        connected: false,
        state: 'disabled' as const,
        safeErrorCategory: 'not_configured',
        checkedAt: new Date().toISOString(),
      } satisfies MessagingTransportHealth);
    // A transport problem must be observable without making core readiness imply a false WhatsApp
    // connection. The response itself carries the precise transport state.
    return reply.header('cache-control', 'no-store').code(200).send(health);
  });
  registerEvolutionWebhookRoute(app, options.evolutionWebhook);

  return app;
}
