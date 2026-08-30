import type { RuntimeEnvironment } from '@jarvis/config';
import { getDatabaseFoundationStatus, getQueueFoundationStatus } from '@jarvis/database';
import { healthResponseSchema } from '@jarvis/contracts';
import type { HealthCheckStatus, HealthResponse } from '@jarvis/contracts';
import { createFoundationReadinessResponse, createLiveHealthResponse } from '@jarvis/observability';

export interface ApiReadinessDependencies {
  readonly databaseVerified?: boolean;
  readonly queueStarted?: boolean;
  /** Configuration-only status; the readiness probe never performs a billable model request. */
  readonly modelConfigured?: boolean;
}

function modelReadiness(configured: boolean | undefined): HealthCheckStatus {
  if (configured === true) {
    return 'pass';
  }
  if (configured === false) {
    return 'not_configured';
  }
  return 'not_initialized';
}

export function getApiLiveHealth(): HealthResponse {
  return healthResponseSchema.parse(createLiveHealthResponse('api'));
}

export function getApiReadinessHealth(
  environment: Pick<RuntimeEnvironment, 'appEnvironment' | 'databaseUrl'>,
  dependencies: ApiReadinessDependencies = {},
): HealthResponse {
  const database = getDatabaseFoundationStatus({
    appEnvironment: environment.appEnvironment,
    databaseUrl: environment.databaseUrl,
    verified: dependencies.databaseVerified,
  });
  const queue = getQueueFoundationStatus({
    appEnvironment: environment.appEnvironment,
    started: dependencies.queueStarted ?? false,
    workerHeartbeatVerified: false,
    workerHeartbeatRequired: false,
  });

  return healthResponseSchema.parse(
    createFoundationReadinessResponse('api', {
      configuration: 'pass',
      database: database.status,
      queue: queue.status,
      model: modelReadiness(dependencies.modelConfigured),
    }),
  );
}
