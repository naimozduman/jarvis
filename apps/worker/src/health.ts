import { getDatabaseFoundationStatus } from '@jarvis/database';
import { getIntegrationFoundationStatus } from '@jarvis/integrations';
import { createFoundationReadinessResponse, createLiveHealthResponse } from '@jarvis/observability';
import { healthResponseSchema } from '@jarvis/schemas';
import type { HealthResponse } from '@jarvis/schemas';

export function getWorkerLiveHealth(): HealthResponse {
  return healthResponseSchema.parse(createLiveHealthResponse('worker'));
}

export function getWorkerReadinessHealth(): HealthResponse {
  const database = getDatabaseFoundationStatus();
  const integrations = getIntegrationFoundationStatus();

  return healthResponseSchema.parse(
    createFoundationReadinessResponse('worker', {
      configuration: 'pass',
      database: database.status,
      queue: 'not_initialized',
      integrations: integrations.status,
    }),
  );
}
