import { getDatabaseFoundationStatus } from '@jarvis/database';
import { createFoundationReadinessResponse, createLiveHealthResponse } from '@jarvis/observability';
import { healthResponseSchema } from '@jarvis/schemas';
import type { HealthResponse } from '@jarvis/schemas';

export function getApiLiveHealth(): HealthResponse {
  return healthResponseSchema.parse(createLiveHealthResponse('api'));
}

export function getApiReadinessHealth(): HealthResponse {
  const database = getDatabaseFoundationStatus();

  return healthResponseSchema.parse(
    createFoundationReadinessResponse('api', {
      configuration: 'pass',
      database: database.status,
      queue: 'not_initialized',
    }),
  );
}
