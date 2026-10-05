import { afterEach, describe, expect, test, vi } from 'vitest';
import { TelegramBotClient } from '../src/telegram-bot-client.js';

afterEach(() => vi.unstubAllGlobals());

describe('Telegram final send provider evidence', () => {
  test.each([
    {
      body: { ok: false, error_code: 503 },
      disposition: 'retryable_failure',
      category: 'telegram_bot_temporary_rejection',
      reconcile: false,
    },
    {
      body: { ok: false, error_code: 429, parameters: { retry_after: 45 } },
      disposition: 'retryable_failure',
      category: 'telegram_bot_rate_limited',
      reconcile: false,
      wait: 45,
    },
    {
      body: {
        ok: false,
        error_code: 403,
        description: 'Sensitive provider description must not be persisted.',
      },
      disposition: 'terminal_failure',
      category: 'telegram_bot_http_403',
      reconcile: false,
    },
    {
      body: { ok: true },
      disposition: 'retryable_failure',
      category: 'telegram_bot_outcome_unknown',
      reconcile: true,
    },
    {
      body: { ok: 'true', result: { message_id: 7 } },
      disposition: 'retryable_failure',
      category: 'telegram_bot_outcome_unknown',
      reconcile: true,
    },
    {
      body: { ok: true, result: { message_id: 1.5 } },
      disposition: 'retryable_failure',
      category: 'telegram_bot_outcome_unknown',
      reconcile: true,
    },
    {
      body: { error_code: 503 },
      disposition: 'retryable_failure',
      category: 'telegram_bot_outcome_unknown',
      reconcile: true,
    },
    {
      body: { ok: false, error_code: '503' },
      disposition: 'retryable_failure',
      category: 'telegram_bot_outcome_unknown',
      reconcile: true,
    },
    {
      body: null,
      disposition: 'retryable_failure',
      category: 'telegram_bot_outcome_unknown',
      reconcile: true,
    },
    {
      body: { ok: false, error_code: 429, parameters: { retry_after: -1 } },
      disposition: 'retryable_failure',
      category: 'telegram_bot_rate_limited',
      reconcile: false,
    },
  ])(
    'classifies provider evidence $body',
    async ({ body, disposition, category, reconcile, ...row }) => {
      const fetchMock = vi.fn().mockResolvedValue({ json: async () => body });
      vi.stubGlobal('fetch', fetchMock);
      const result = await new TelegramBotClient('synthetic-token').sendText(
        '123456',
        'Synthetic reminder',
      );
      expect(result).toMatchObject({
        disposition,
        errorCategory: category,
        requiresReconciliation: reconcile,
        acceptedAt: null,
        providerMessageReference: null,
      });
      expect(result.retryAfterSeconds).toBe('wait' in row ? row.wait : undefined);
      expect(JSON.stringify(result)).not.toContain('Sensitive provider description');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  test.each(['timeout', 'network', 'unreadable_response'])(
    'holds an unknown %s outcome without retrying',
    async (kind) => {
      const fetchMock =
        kind === 'unreadable_response'
          ? vi.fn().mockResolvedValue({
              json: async () => {
                throw new Error('Invalid response');
              },
            })
          : vi.fn().mockRejectedValue(new Error(kind));
      vi.stubGlobal('fetch', fetchMock);
      expect(
        await new TelegramBotClient('synthetic-token').sendText('123456', 'Synthetic reminder'),
      ).toMatchObject({
        disposition: 'retryable_failure',
        requiresReconciliation: true,
        errorCategory: 'telegram_bot_outcome_unknown',
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  test('requires a concrete acceptance receipt and returns only an opaque message reference', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: async () => ({ ok: true, result: { message_id: 7 } }) }),
    );
    const result = await new TelegramBotClient('synthetic-token').sendText(
      '123456',
      'Synthetic reminder',
    );
    expect(result).toMatchObject({
      disposition: 'accepted',
      errorCategory: null,
      requiresReconciliation: false,
    });
    expect(result.providerMessageReference).toMatch(/^tg:message:[a-f0-9]{64}$/u);
    expect(result.acceptedAt).not.toBeNull();
  });
});
