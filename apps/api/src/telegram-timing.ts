import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { createSafeLogRecord } from '@jarvis/observability';

const clockId = randomUUID();
const segments = new AsyncLocalStorage<{
  readonly id: string;
  readonly startedAt: number;
  telegram: boolean;
}>();

export type TelegramTimingStage =
  | 'webhook_received'
  | 'authentication_complete'
  | 'inbound_persistence_complete'
  | 'owner_resolution_complete'
  | 'typing_launched'
  | 'typing_accepted'
  | 'typing_failed'
  | 'canonical_event_queued'
  | 'brain_dispatch'
  | 'model_complete'
  | 'response_persisted'
  | 'final_send_accepted';

/** Process-local monotonic durations; timestamps correlate segments across queue invocations. */
export function withTelegramTiming<T>(operation: () => T): T {
  return segments.run(
    { id: randomUUID(), startedAt: performance.now(), telegram: false },
    operation,
  );
}

export function isTelegramTimingActive(): boolean {
  return segments.getStore()?.telegram ?? false;
}

/** Deliberately typed allowlist: no provider identities, message text or owner context. */
export function recordTelegramTiming(
  stage: TelegramTimingStage,
  fields: {
    readonly sourceEventId?: string;
    readonly eventId?: string;
    readonly requestId?: string;
    readonly deliveryId?: string;
    readonly duplicate?: boolean;
    readonly enrolled?: boolean;
    readonly latencyMs?: number;
    readonly queueLatencyMs?: number;
    readonly status?: string;
  } = {},
): void {
  try {
    const at = performance.now();
    const segment = segments.getStore();
    if (segment) segment.telegram = true;
    console.info(
      JSON.stringify(
        createSafeLogRecord('telegram.turn.timing', {
          stage,
          clockId,
          monotonicMs: at,
          ...(segment ? { segmentId: segment.id, segmentElapsedMs: at - segment.startedAt } : {}),
          ...fields,
        }),
      ),
    );
  } catch {
    // Telemetry must never change transport or Brain outcomes.
  }
}
