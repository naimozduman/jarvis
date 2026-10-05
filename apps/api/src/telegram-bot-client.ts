import { createHash } from 'node:crypto';

import type { MessagingSendResult } from '@jarvis/contracts';

function opaqueMessageReference(chatId: string, messageId: number): string {
  return `tg:message:${createHash('sha256').update(`${chatId}:${messageId}`, 'utf8').digest('hex')}`;
}
type TelegramResult = {
  readonly ok?: boolean;
  readonly result?: { readonly message_id?: number };
  readonly error_code?: number;
  readonly parameters?: { readonly retry_after?: number };
};

export type TelegramTypingResult = {
  readonly accepted: boolean;
};

function safeWebhookErrorCategory(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes('401') || normalized.includes('unauthorized')) {
    return 'webhook_unauthorized';
  }
  if (normalized.includes('404') || normalized.includes('not found')) {
    return 'webhook_not_found';
  }
  if (normalized.includes('403') || normalized.includes('forbidden')) {
    return 'webhook_forbidden';
  }
  if (/(^|\D)5\d\d(\D|$)/.test(normalized)) return 'webhook_server_error';
  if (normalized.includes('wrong response')) return 'webhook_response_rejected';
  return 'webhook_delivery_error';
}

/** Minimal official Bot API client. It never serializes a token, raw target, or provider response into logs. */
export class TelegramBotClient {
  public constructor(private readonly token: string) {}
  private async post(
    method: string,
    body: Record<string, unknown>,
  ): Promise<TelegramResult | undefined> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await response.json().catch(() => undefined)) as TelegramResult | undefined;
      return json;
    } catch {
      return undefined;
    }
  }
  public async typing(chatId: string): Promise<TelegramTypingResult> {
    return {
      accepted: Boolean(
        (await this.post('sendChatAction', { chat_id: chatId, action: 'typing' }))?.ok,
      ),
    };
  }
  /** Reserved for a future streamed response. Non-streaming turns never manufacture draft text. */
  public async draft(chatId: string, draftId: number, text = ''): Promise<boolean> {
    return Boolean(
      (await this.post('sendMessageDraft', { chat_id: chatId, draft_id: draftId, text }))?.ok,
    );
  }
  public async sendText(chatId: string, text: string): Promise<MessagingSendResult> {
    const result = await this.post('sendMessage', { chat_id: chatId, text });
    if (
      result?.ok === true &&
      Number.isSafeInteger(result.result?.message_id) &&
      result.result!.message_id! > 0
    )
      return {
        disposition: 'accepted',
        providerMessageReference: opaqueMessageReference(chatId, result.result!.message_id!),
        acceptedAt: new Date().toISOString(),
        errorCategory: null,
        requiresReconciliation: false,
      };
    // Only a valid Bot API unsuccessful response proves nonacceptance. HTTP status,
    // malformed JSON, or a success without its receipt cannot authorize another send.
    const code = result?.error_code;
    if (result?.ok === false && Number.isSafeInteger(code) && code! >= 400 && code! <= 599) {
      const retryable = code === 429 || code! >= 500;
      const wait = result.parameters?.retry_after;
      return {
        disposition: retryable ? 'retryable_failure' : 'terminal_failure',
        providerMessageReference: null,
        acceptedAt: null,
        errorCategory:
          code === 429
            ? 'telegram_bot_rate_limited'
            : retryable
              ? 'telegram_bot_temporary_rejection'
              : `telegram_bot_http_${code}`,
        requiresReconciliation: false,
        ...(retryable && Number.isSafeInteger(wait) && wait! >= 0 && wait! <= 2_147_483_647
          ? { retryAfterSeconds: wait! }
          : {}),
      };
    }
    return {
      disposition: 'retryable_failure',
      providerMessageReference: null,
      acceptedAt: null,
      errorCategory: 'telegram_bot_outcome_unknown',
      requiresReconciliation: true,
    };
  }
  public async setWebhook(input: {
    readonly url: string;
    readonly secretToken: string;
  }): Promise<boolean> {
    return Boolean(
      (
        await this.post('setWebhook', {
          url: input.url,
          secret_token: input.secretToken,
          allowed_updates: ['message'],
          drop_pending_updates: false,
        })
      )?.ok,
    );
  }
  public async webhookInfo(): Promise<{
    readonly configured: boolean;
    readonly pendingUpdateCount: number;
    readonly lastErrorCategory: string | null;
  }> {
    const result = await this.post('getWebhookInfo', {});
    const info = result?.result as Record<string, unknown> | undefined;
    const url = typeof info?.url === 'string' ? info.url : '';
    const pending = Number.isSafeInteger(info?.pending_update_count)
      ? (info?.pending_update_count as number)
      : 0;
    return {
      configured: Boolean(result?.ok && url),
      pendingUpdateCount: pending,
      lastErrorCategory: result?.ok
        ? safeWebhookErrorCategory(info?.last_error_message)
        : `telegram_bot_http_${result?.error_code ?? 'unknown'}`,
    };
  }
}
