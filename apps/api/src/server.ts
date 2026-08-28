import type { FastifyInstance } from 'fastify';

import { loadApiEnvironment } from '@jarvis/config';

import { buildApi } from './app.js';

async function start(): Promise<void> {
  let app: FastifyInstance | undefined;

  try {
    const environment = loadApiEnvironment();
    app = buildApi();
    await app.listen({
      host: '0.0.0.0',
      port: environment.apiPort,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown startup error';
    console.error(`API startup failed: ${message}`);

    if (app) {
      await app.close();
    }

    process.exitCode = 1;
  }
}

void start();
