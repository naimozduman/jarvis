import { createServer } from 'node:http';
import type { Server } from 'node:http';

import { loadWorkerEnvironment } from '@jarvis/config';
import type { EnvironmentSource } from '@jarvis/config';
import type { HealthResponse } from '@jarvis/contracts';

import { getWorkerLiveHealth, getWorkerReadinessHealth } from './health.js';

interface WorkerReadinessState {
  readonly databaseVerified?: boolean;
  readonly queueStarted?: boolean;
  readonly workerHeartbeatVerified?: boolean;
  readonly modelConfigured?: boolean;
}

export interface WorkerHealthRouteResponse {
  readonly statusCode: 200 | 404 | 503;
  readonly body: HealthResponse | Readonly<{ error: 'not_found' }>;
}

export interface WorkerHealthOptions {
  readonly environment?: EnvironmentSource;
  readonly readiness?: WorkerReadinessState | (() => WorkerReadinessState);
  readonly readinessProbe?: () => Promise<void>;
}

function resolveReadiness(readiness: WorkerHealthOptions['readiness']): WorkerReadinessState {
  if (typeof readiness === 'function') {
    return readiness();
  }
  return readiness ?? {};
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
      const health = getWorkerReadinessHealth(environment, resolveReadiness(options.readiness));
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

/** Async counterpart used by the real runtime so readiness can re-probe PostgreSQL on demand. */
export async function resolveWorkerHealthRouteAsync(
  pathname: string,
  options: WorkerHealthOptions = {},
): Promise<WorkerHealthRouteResponse> {
  if (pathname === '/health/ready') {
    try {
      await options.readinessProbe?.();
    } catch {
      // The runtime keeps a safe dependency state and health must not disclose raw DB failures.
    }
  }
  return resolveWorkerHealthRoute(pathname, options);
}

export function createWorkerHealthServer(options: WorkerHealthOptions = {}): Server {
  return createServer((request, response) => {
    void (async () => {
      const pathname = request.url?.split('?')[0] ?? '/';
      const result = await resolveWorkerHealthRouteAsync(pathname, options);

      response.writeHead(result.statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(JSON.stringify(result.body));
    })().catch(() => {
      response.writeHead(503, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(JSON.stringify({ error: 'service_unavailable' }));
    });
  });
}
