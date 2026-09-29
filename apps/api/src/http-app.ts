import Fastify from 'fastify';
import {
  registerPersonalSystemRoutes,
  type PersonalSystemRouteDependencies,
} from './personal-system-routes.js';
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
  registerOrchestrationRoutes,
  type OrchestrationRouteDependencies,
} from './orchestration-routes.js';
import {
  registerLocalBridgeRoutes,
  type LocalBridgeRouteDependencies,
} from './local-bridge-routes.js';
import {
  registerStagingRuntimeRoutes,
  type StagingRuntimeRouteDependencies,
} from './staging-runtime-routes.js';
import {
  registerStagingC7HarnessRoutes,
  type StagingC7HarnessRouteDependencies,
} from './staging-c7-harness-routes.js';
import {
  registerPhase3d1JobRecoveryRoute,
  type Phase3d1JobRecoveryRouteDependencies,
} from './phase-3-6d1-job-recovery-route.js';

interface ApiReadinessState {
  readonly databaseVerified?: boolean;
  readonly queueStarted?: boolean;
  readonly modelConfigured?: boolean;
}

export interface BuildApiOptions {
  readonly personalSystem?: PersonalSystemRouteDependencies;
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
  /** Fixed C.7 staging release-gate suite; absent from normal API construction. */
  readonly stagingC7Harness?: StagingC7HarnessRouteDependencies;
  /** Exact one-job Phase 3.6D.1 recovery; absent unless its temporary credential exists. */
  readonly phase3d1JobRecovery?: Phase3d1JobRecoveryRouteDependencies;
  /** Narrow Convex-to-Vercel callback; absent from normal API construction. */
  readonly orchestration?: OrchestrationRouteDependencies;
  /** Authenticated local-only transport boundary; absent unless Vercel explicitly composes it. */
  readonly localBridge?: LocalBridgeRouteDependencies;
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

/**
 * Composes canonical in-process Fastify routes. This library filename intentionally avoids
 * Vercel's Fastify entrypoint candidates; apps/api/server.ts is the sole deployable entrypoint.
 */
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
  if (environment.appEnvironment === 'staging') {
    registerStagingC7HarnessRoutes(app, options.stagingC7Harness);
    registerPhase3d1JobRecoveryRoute(app, options.phase3d1JobRecovery);
  }
  registerOrchestrationRoutes(app, options.orchestration);
  registerPersonalSystemRoutes(app, options.personalSystem);
  registerLocalBridgeRoutes(app, options.localBridge);

  return app;
}
