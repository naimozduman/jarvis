import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { loadApiEnvironment } from '@jarvis/config';
import type { EnvironmentSource } from '@jarvis/config';

import { getApiLiveHealth, getApiReadinessHealth } from './health.js';

export interface BuildApiOptions {
  readonly environment?: EnvironmentSource;
}

export function buildApi(options: BuildApiOptions = {}): FastifyInstance {
  void loadApiEnvironment(options.environment ?? process.env);

  const app = Fastify({
    logger: false,
  });

  app.get('/health/live', async () => getApiLiveHealth());
  app.get('/health/ready', async () => getApiReadinessHealth());

  return app;
}
