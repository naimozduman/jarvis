import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { createSafeLogRecord } from '@jarvis/observability';
import type { TelegramBotTurnUx } from '@jarvis/orchestration';
import { recordTelegramTiming } from './telegram-timing.js';

export interface TelegramTypingClient {
  typing(chatId: string): Promise<{ readonly accepted: boolean }>;
}

export interface TelegramTypingUxOptions {
  readonly client: TelegramTypingClient;
  readonly resolveChatId: (targetReference: string) => Promise<string | null>;
  readonly refreshAfterMs?: number;
  /** Initial typing is owned/deduplicated by ingress; the worker only refreshes an active turn. */
  readonly refreshOnly?: boolean;
  readonly now?: () => number;
  readonly log?: (record: ReturnType<typeof createSafeLogRecord>) => void;
}

type ActiveTurn = { readonly targetReference: string; timer: ReturnType<typeof setTimeout> | null };

/**
 * Best-effort Telegram-only presentation. It has no authority over a Brain turn or delivery.
 * Timers are unreferenced so delayed UX can never hold a serverless request open.
 */
export class TelegramTypingUx implements TelegramBotTurnUx {
  private readonly active = new Map<string, ActiveTurn>();
  private readonly refreshAfterMs: number;
  private readonly now: () => number;
  private readonly log: (record: ReturnType<typeof createSafeLogRecord>) => void;

  public constructor(private readonly options: TelegramTypingUxOptions) {
    this.refreshAfterMs = options.refreshAfterMs ?? 4_000;
    this.now = options.now ?? (() => performance.now());
    this.log = options.log ?? ((record) => console.info(JSON.stringify(record)));
  }

  public async begin(input: {
    readonly targetReference: string;
    readonly operationKey: string;
  }): Promise<void> {
    if (this.active.has(input.operationKey)) return;
    this.active.set(input.operationKey, { targetReference: input.targetReference, timer: null });
    if (this.options.refreshOnly) this.scheduleRefresh(input.operationKey);
    else void this.issue(input.operationKey, 'initial');
  }

  public async end(input: {
    readonly targetReference: string;
    readonly operationKey: string;
  }): Promise<void> {
    const active = this.active.get(input.operationKey);
    if (!active) return;
    if (active.timer) clearTimeout(active.timer);
    this.active.delete(input.operationKey);
  }

  private telemetry(
    operationKey: string,
    outcome: 'attempted' | 'accepted' | 'failed',
    latencyMs: number,
    phase: 'initial' | 'refresh',
  ): void {
    try {
      this.log(
        createSafeLogRecord('telegram.typing', {
          outcome,
          phase,
          latencyMs,
          operationKeyHash: createHash('sha256').update(operationKey, 'utf8').digest('hex'),
        }),
      );
    } catch {
      /* UX telemetry cannot fail an authoritative turn. */
    }
  }

  private async issue(operationKey: string, phase: 'initial' | 'refresh'): Promise<void> {
    const active = this.active.get(operationKey);
    if (!active) return;
    const startedAt = this.now();
    this.telemetry(operationKey, 'attempted', 0, phase);
    try {
      const chatId = await this.options.resolveChatId(active.targetReference);
      if (!chatId) {
        this.telemetry(operationKey, 'failed', this.now() - startedAt, phase);
        return;
      }
      const result = await this.options.client.typing(chatId);
      this.telemetry(
        operationKey,
        result.accepted ? 'accepted' : 'failed',
        this.now() - startedAt,
        phase,
      );
    } catch {
      this.telemetry(operationKey, 'failed', this.now() - startedAt, phase);
    }
    this.scheduleRefresh(operationKey);
  }

  private scheduleRefresh(operationKey: string): void {
    const active = this.active.get(operationKey);
    if (!active) return;
    const timer = setTimeout(() => void this.issue(operationKey, 'refresh'), this.refreshAfterMs);
    timer.unref?.();
    active.timer = timer;
  }
}

/** Single initial request, no refresh timer or canonical mutation. The caller owns durable dedup. */
export async function sendInitialTelegramTyping(input: {
  readonly client: TelegramTypingClient;
  readonly providerChatId: string;
  readonly sourceEventId: string;
  readonly eventId: string;
}): Promise<void> {
  const startedAt = performance.now();
  const ids = { sourceEventId: input.sourceEventId, eventId: input.eventId };
  recordTelegramTiming('typing_launched', ids);
  try {
    const result = await input.client.typing(input.providerChatId);
    recordTelegramTiming(result.accepted ? 'typing_accepted' : 'typing_failed', {
      ...ids,
      latencyMs: performance.now() - startedAt,
    });
  } catch {
    recordTelegramTiming('typing_failed', { ...ids, latencyMs: performance.now() - startedAt });
  }
}
