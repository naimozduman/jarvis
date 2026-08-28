import { createServer } from 'node:http';
import type { Server } from 'node:http';

import type { HealthResponse } from '@jarvis/schemas';

import { getWorkerLiveHealth, getWorkerReadinessHealth } from './health.js';

export interface WorkerHealthRouteResponse {
  readonly statusCode: 200 | 404;
  readonly body: HealthResponse | Readonly<{ error: 'not_found' }>;
}

export function resolveWorkerHealthRoute(pathname: string): WorkerHealthRouteResponse {
  switch (pathname) {
    case '/health/live':
      return {
        statusCode: 200,
        body: getWorkerLiveHealth(),
      };
    case '/health/ready':
      return {
        statusCode: 200,
        body: getWorkerReadinessHealth(),
      };
    default:
      return {
        statusCode: 404,
        body: {
          error: 'not_found',
        },
      };
  }
}

export function createWorkerHealthServer(): Server {
  return createServer((request, response) => {
    const pathname = request.url?.split('?')[0] ?? '/';
    const result = resolveWorkerHealthRoute(pathname);

    response.writeHead(result.statusCode, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify(result.body));
  });
}
