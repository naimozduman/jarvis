import type { RuntimeEnvironment } from '@jarvis/config';
import { getDatabaseFoundationStatus, getQueueFoundationStatus } from '@jarvis/database';
import { healthResponseSchema } from '@jarvis/contracts';
import type { HealthCheckStatus, HealthResponse } from '@jarvis/contracts';
import { getIntegrationFoundationStatus } from '@jarvis/integrations';
import { createFoundationReadinessResponse, createLiveHealthResponse } from '@jarvis/observability';

export interface WorkerReadinessDependencies {
  readonly databaseVerified?: boolean;
  readonly queueStarted?: boolean;
  readonly workerHeartbeatVerified?: boolean;
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

export function getWorkerLiveHealth(): HealthResponse {
  return healthResponseSchema.parse(createLiveHealthResponse('worker'));
}

export function getWorkerReadinessHealth(
  environment: Pick<RuntimeEnvironment, 'appEnvironment' | 'databaseUrl'>,
  dependencies: WorkerReadinessDependencies = {},
): HealthResponse {
  const database = getDatabaseFoundationStatus({
    appEnvironment: environment.appEnvironment,
    databaseUrl: environment.databaseUrl,
    verified: dependencies.databaseVerified,
  });
  const queue = getQueueFoundationStatus({
    appEnvironment: environment.appEnvironment,
    started: dependencies.queueStarted ?? false,
    workerHeartbeatVerified: dependencies.workerHeartbeatVerified ?? false,
  });
  const integrations = getIntegrationFoundationStatus();

  return healthResponseSchema.parse(
    createFoundationReadinessResponse('worker', {
      configuration: 'pass',
      database: database.status,
      queue: queue.status,
      integrations: integrations.status,
      model: modelReadiness(dependencies.modelConfigured),
    }),
  );
}
