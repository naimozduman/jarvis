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
import {
  registerStagingRuntimeRoutes,
  type StagingRuntimeRouteDependencies,
} from './staging-runtime-routes.js';

interface ApiReadinessState {
  readonly databaseVerified?: boolean;
  readonly queueStarted?: boolean;
  readonly modelConfigured?: boolean;
}

export interface BuildApiOptions {
  readonly environment?: EnvironmentSource;
  readonly readiness?: ApiReadinessState | (() => ApiReadinessState);
  /** A runtime-owned dependency probe; errors are represented by readiness state, never leaked. */
  readonly readinessProbe?: () => Promise<void>;
  /** Explicit composition only; disabled/default API instances never call Evolution. */
  readonly evolutionWebhook?: EvolutionWebhookIngressDependencies;
  /** Transport health is informational and separate from core API readiness. */
  readonly evolutionTransportHealth?: () => Promise<MessagingTransportHealth>;
  /** Narrow, authenticated staging-only route; absent from normal API construction. */
  readonly stagingRuntime?: StagingRuntimeRouteDependencies;
}

function resolveReadiness(readiness: BuildApiOptions['readiness']): ApiReadinessState {
  if (typeof readiness === 'function') {
    return readiness();
  }
  return readiness ?? {};
}

function disabledEvolutionTransportHealth(): MessagingTransportHealth {
  return {
    transport: 'evolution_whatsapp',
    configured: false,
    versionVerified: false,
    reachable: false,
    authenticated: false,
    connected: false,
    state: 'disabled',
    safeErrorCategory: 'not_configured',
    checkedAt: new Date().toISOString(),
  };
}

function unavailableEvolutionTransportHealth(): MessagingTransportHealth {
  return {
    transport: 'evolution_whatsapp',
    configured: true,
    // A failed health callback cannot prove provider build identity, even if composition had
    // verified it before the probe. Avoid reporting stale success after an unexpected failure.
    versionVerified: false,
    reachable: false,
    authenticated: false,
    connected: false,
    state: 'degraded',
    safeErrorCategory: 'transport_health_unavailable',
    checkedAt: new Date().toISOString(),
  };
}

export function buildApi(options: BuildApiOptions = {}): FastifyInstance {
  const environment = loadApiEnvironment(options.environment ?? process.env);

  const app = Fastify({
    logger: false,
  });

  app.get('/health/live', async () => getApiLiveHealth());
  app.get('/health/ready', async (request, reply) => {
    try {
      await options.readinessProbe?.();
    } catch {
      // The runtime probe owns its own safe state. A health endpoint never emits dependency text.
    }
    const health = getApiReadinessHealth(environment, resolveReadiness(options.readiness));
    return reply.code(health.status === 'ok' ? 200 : 503).send(health);
  });
  app.get('/health/transport/evolution', async (_request, reply) => {
    let health: MessagingTransportHealth;
    try {
      health = (await options.evolutionTransportHealth?.()) ?? disabledEvolutionTransportHealth();
    } catch {
      // An adapter exception must neither disclose headers/provider text nor make core readiness
      // look unhealthy. The dedicated transport probe reports an opaque degraded state instead.
      health = unavailableEvolutionTransportHealth();
    }
    // A transport problem must be observable without making core readiness imply a false WhatsApp
    // connection. The response itself carries the precise transport state.
    return reply.header('cache-control', 'no-store').code(200).send(health);
  });
  registerEvolutionWebhookRoute(app, options.evolutionWebhook);
  registerStagingRuntimeRoutes(app, options.stagingRuntime);

  return app;
}
