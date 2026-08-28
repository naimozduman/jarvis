import { randomUUID } from 'node:crypto';

import type { HealthCheckStatus, HealthResponse, ServiceName } from '@jarvis/contracts';
import { foundationVersion } from '@jarvis/domain';
import { redactSensitiveFields } from '@jarvis/security';

export interface SafeLogRecord {
  readonly timestamp: string;
  readonly correlationId: string;
  readonly event: string;
  readonly fields: Record<string, unknown>;
}

export function createCorrelationId(): string {
  return randomUUID();
}

export function resolveCorrelationId(candidate: string | undefined): string {
  const validUuid =
    candidate !== undefined &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate);

  return validUuid ? candidate : createCorrelationId();
}

export function createSafeLogRecord(
  event: string,
  fields: Readonly<Record<string, unknown>> = {},
): SafeLogRecord {
  return {
    timestamp: new Date().toISOString(),
    correlationId: createCorrelationId(),
    event,
    fields: redactSensitiveFields(fields),
  };
}

export function createLiveHealthResponse(service: ServiceName): HealthResponse {
  return {
    service,
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: foundationVersion,
    correlationId: createCorrelationId(),
    checks: {
      process: 'pass',
    },
  };
}

export function createFoundationReadinessResponse(
  service: ServiceName,
  checks: Readonly<Record<string, HealthCheckStatus>>,
): HealthResponse {
  return {
    service,
    status: Object.values(checks).some((check) => check === 'fail') ? 'not_ready' : 'ok',
    timestamp: new Date().toISOString(),
    version: foundationVersion,
    correlationId: createCorrelationId(),
    checks: { ...checks },
  };
}
