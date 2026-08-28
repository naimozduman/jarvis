import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { loadApiEnvironment } from '@jarvis/config';
import type { EnvironmentSource } from '@jarvis/config';

import { getApiLiveHealth, getApiReadinessHealth } from './health.js';

export interface BuildApiOptions {
  readonly environment?: EnvironmentSource;
  readonly readiness?: {
    readonly databaseVerified?: boolean;
    readonly queueStarted?: boolean;
  };
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

  return app;
}
