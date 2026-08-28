import { createServer } from 'node:http';
import type { Server } from 'node:http';

import { loadWorkerEnvironment } from '@jarvis/config';
import type { EnvironmentSource } from '@jarvis/config';
import type { HealthResponse } from '@jarvis/contracts';

import { getWorkerLiveHealth, getWorkerReadinessHealth } from './health.js';

export interface WorkerHealthRouteResponse {
  readonly statusCode: 200 | 404 | 503;
  readonly body: HealthResponse | Readonly<{ error: 'not_found' }>;
}

export interface WorkerHealthOptions {
  readonly environment?: EnvironmentSource;
  readonly readiness?: {
    readonly databaseVerified?: boolean;
    readonly queueStarted?: boolean;
    readonly workerHeartbeatVerified?: boolean;
  };
}

export function resolveWorkerHealthRoute(
  pathname: string,
  options: WorkerHealthOptions = {},
): WorkerHealthRouteResponse {
  const environment = loadWorkerEnvironment(options.environment ?? process.env);

  switch (pathname) {
    case '/health/live':
      return {
        statusCode: 200,
        body: getWorkerLiveHealth(),
      };
    case '/health/ready': {
      const health = getWorkerReadinessHealth(environment, options.readiness);
      return {
        statusCode: health.status === 'ok' ? 200 : 503,
        body: health,
      };
    }
    default:
      return {
        statusCode: 404,
        body: {
          error: 'not_found',
        },
      };
  }
}

export function createWorkerHealthServer(options: WorkerHealthOptions = {}): Server {
  return createServer((request, response) => {
    const pathname = request.url?.split('?')[0] ?? '/';
    const result = resolveWorkerHealthRoute(pathname, options);

    response.writeHead(result.statusCode, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify(result.body));
  });
}
