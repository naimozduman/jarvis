import { performance } from 'node:perf_hooks';
import { describe, expect, it, vi } from 'vitest';

import {
  isTelegramTimingActive,
  recordTelegramTiming,
  withTelegramTiming,
} from '../src/telegram-timing.js';

describe('safe Telegram monotonic telemetry', () => {
  it('measures local durations using a monotonic clock, with one segment spanning async ingress', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const clock = vi.spyOn(performance, 'now');
    let at = 100;
    clock.mockImplementation(() => at);
    try {
      await withTelegramTiming(async () => {
        expect(isTelegramTimingActive()).toBe(false);
        recordTelegramTiming('webhook_received');
        await Promise.resolve();
        at = 150;
        recordTelegramTiming('typing_launched', { eventId: 'canonical-event' });
        expect(isTelegramTimingActive()).toBe(true);
      });
      const records = log.mock.calls.map(([record]) => JSON.parse(String(record)));
      expect(records[0].fields.segmentElapsedMs).toBe(0);
      expect(records[1].fields.segmentElapsedMs).toBe(50);
      expect(records[1].fields.segmentId).toBe(records[0].fields.segmentId);
      expect(records[1].fields.clockId).toBe(records[0].fields.clockId);
      expect(isTelegramTimingActive()).toBe(false);
    } finally {
      clock.mockRestore();
      log.mockRestore();
    }
  });
});
