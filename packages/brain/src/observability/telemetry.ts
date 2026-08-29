import { createHash } from 'node:crypto';

import type { BrainTelemetry } from '@jarvis/contracts';

export interface BrainTelemetrySink {
  record(telemetry: BrainTelemetry): Promise<void> | void;
}

export function opaqueOwnerReference(ownerId: string): string {
  return createHash('sha256').update(`jarvis-owner:${ownerId}`, 'utf8').digest('hex').slice(0, 32);
}

/** Test-friendly sink. Production adapters may forward the same safe shape to observability. */
export class InMemoryBrainTelemetrySink implements BrainTelemetrySink {
  public readonly records: BrainTelemetry[] = [];
  public record(telemetry: BrainTelemetry): void {
    this.records.push(telemetry);
  }
}
