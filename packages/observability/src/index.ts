import { randomUUID } from 'node:crypto';

import { foundationVersion } from '@jarvis/domain';
import type { FoundationService } from '@jarvis/domain';
import type { HealthCheckStatus, HealthResponse } from '@jarvis/schemas';
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

export function createLiveHealthResponse(service: FoundationService): HealthResponse {
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
  service: FoundationService,
  checks: Readonly<Record<string, HealthCheckStatus>>,
): HealthResponse {
  return {
    service,
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: foundationVersion,
    correlationId: createCorrelationId(),
    checks: { ...checks },
  };
}
