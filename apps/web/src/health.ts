import { createLiveHealthResponse } from '@jarvis/observability';
import { healthResponseSchema } from '@jarvis/schemas';
import type { HealthResponse } from '@jarvis/schemas';

export function getWebHealth(): HealthResponse {
  return healthResponseSchema.parse(createLiveHealthResponse('web'));
}

/**
 * Framework-neutral route-handler skeleton for the future web application.
 * A Next.js route can re-export this handler at /api/health without changing
 * the public health contract.
 */
export function GET(): Response {
  return Response.json(getWebHealth(), {
    headers: {
      'cache-control': 'no-store',
    },
  });
}
