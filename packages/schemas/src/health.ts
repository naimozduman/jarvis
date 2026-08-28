import { foundationServices } from '@jarvis/domain';
import { z } from 'zod';

export const serviceNameSchema = z.enum(foundationServices);
export type ServiceName = z.infer<typeof serviceNameSchema>;

export const healthStatusSchema = z.enum(['ok', 'not_ready']);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const healthCheckStatusSchema = z.enum(['pass', 'fail', 'not_initialized']);
export type HealthCheckStatus = z.infer<typeof healthCheckStatusSchema>;

export const healthResponseSchema = z
  .object({
    service: serviceNameSchema,
    status: healthStatusSchema,
    timestamp: z.string().datetime(),
    version: z.string().min(1),
    correlationId: z.string().uuid(),
    checks: z.record(z.string().min(1), healthCheckStatusSchema),
  })
  .strict();

export type HealthResponse = z.infer<typeof healthResponseSchema>;
