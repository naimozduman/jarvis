import { describe, expect, it, vi } from 'vitest';

import { TelegramTypingUx, sendInitialTelegramTyping } from '../src/telegram-typing-ux.js';

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('TelegramTypingUx', () => {
  it('worker refresh does not repeat ingress initial typing, and ends with the authoritative turn', async () => {
    vi.useFakeTimers();
    try {
      const typing = vi.fn(async () => ({ accepted: true }));
      const ux = new TelegramTypingUx({
        client: { typing },
        resolveChatId: async () => 'private-chat',
        refreshOnly: true,
      });
      const turn = { targetReference: 'opaque-target', operationKey: 'telegram:turn:refresh-only' };
      await ux.begin(turn);
      await ux.begin(turn);
      await vi.advanceTimersByTimeAsync(3999);
      expect(typing).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(typing).toHaveBeenCalledOnce();
      await ux.end(turn);
      await vi.advanceTimersByTimeAsync(8000);
      expect(typing).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('initial typing uses the just-verified recipient without a second database resolution or timer', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      const typing = vi.fn(async () => ({ accepted: true }));
      await sendInitialTelegramTyping({
        client: { typing },
        providerChatId: 'private-chat',
        sourceEventId: 'canonical-source',
        eventId: 'canonical-event',
      });
      expect(typing).toHaveBeenCalledWith('private-chat');
      const telemetry = log.mock.calls.map(([record]) => JSON.parse(String(record)));
      expect(telemetry.map((record) => record.fields.stage)).toEqual([
        'typing_launched',
        'typing_accepted',
      ]);
      expect(JSON.stringify(telemetry)).not.toContain('private-chat');
    } finally {
      log.mockRestore();
    }
  });

  it('initial request and telemetry failure never fail the real turn', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('logging');
    });
    try {
      await expect(
        sendInitialTelegramTyping({
          client: {
            typing: async () => {
              throw new Error('network');
            },
          },
          providerChatId: 'private-chat',
          sourceEventId: 'source',
          eventId: 'event',
        }),
      ).resolves.toBeUndefined();
    } finally {
      log.mockRestore();
    }
  });
  it('starts typing without waiting for the Bot API and records accepted telemetry', async () => {
    let resolveTyping: ((value: { readonly accepted: boolean }) => void) | undefined;
    const typing = vi.fn(
      () => new Promise<{ readonly accepted: boolean }>((resolve) => (resolveTyping = resolve)),
    );
    const logs: unknown[] = [];
    const ux = new TelegramTypingUx({
      client: { typing },
      resolveChatId: async () => 'private-chat',
      log: (record) => logs.push(record),
    });

    await ux.begin({ targetReference: 'opaque-target', operationKey: 'telegram:turn:event' });
    await flush();
    expect(typing).toHaveBeenCalledOnce();
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs[0])).toContain('attempted');

    resolveTyping?.({ accepted: true });
    await flush();
    expect(JSON.stringify(logs[1])).toContain('accepted');
    expect(JSON.stringify(logs[1])).not.toContain('private-chat');
    await ux.end({ targetReference: 'opaque-target', operationKey: 'telegram:turn:event' });
  });

  it('refreshes a long-running turn but stops when the authoritative turn ends', async () => {
    vi.useFakeTimers();
    try {
      const typing = vi.fn(async () => ({ accepted: true }));
      const ux = new TelegramTypingUx({
        client: { typing },
        resolveChatId: async () => 'private-chat',
        refreshAfterMs: 100,
      });
      await ux.begin({ targetReference: 'opaque-target', operationKey: 'telegram:turn:long' });
      await flush();
      expect(typing).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(100);
      await flush();
      expect(typing).toHaveBeenCalledTimes(2);
      await ux.end({ targetReference: 'opaque-target', operationKey: 'telegram:turn:long' });
      await vi.advanceTimersByTimeAsync(300);
      expect(typing).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('records a typing failure but never throws into the owner turn', async () => {
    const logs: unknown[] = [];
    const ux = new TelegramTypingUx({
      client: {
        typing: async () => {
          throw new Error('network');
        },
      },
      resolveChatId: async () => 'private-chat',
      log: (record) => logs.push(record),
    });
    await expect(
      ux.begin({ targetReference: 'opaque-target', operationKey: 'telegram:turn:failed' }),
    ).resolves.toBeUndefined();
    await flush();
    expect(JSON.stringify(logs.at(-1))).toContain('failed');
    await ux.end({ targetReference: 'opaque-target', operationKey: 'telegram:turn:failed' });
  });
});
