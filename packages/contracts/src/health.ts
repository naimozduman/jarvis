import { z } from 'zod';

import { correlationIdSchema, utcTimestampSchema } from './common.js';

export const foundationServices = ['web', 'api', 'worker'] as const;
export const serviceNameSchema = z.enum(foundationServices);
export const healthStatusSchema = z.enum(['ok', 'not_ready']);
/**
 * `not_configured` is distinct from an unavailable dependency: optional model/transport features
 * must never masquerade as healthy, but their absence does not make canonical JARVIS state dead.
 */
export const healthCheckStatusSchema = z.enum([
  'pass',
  'fail',
  'not_initialized',
  'not_configured',
]);

export const healthResponseSchema = z.object({
  service: serviceNameSchema,
  status: healthStatusSchema,
  timestamp: utcTimestampSchema,
  version: z.string().min(1),
  correlationId: correlationIdSchema,
  checks: z.record(z.string(), healthCheckStatusSchema),
});

export type ServiceName = z.infer<typeof serviceNameSchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthCheckStatus = z.infer<typeof healthCheckStatusSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
