import { z } from 'zod';

import {
  classifyEvolutionError,
  classifyEvolutionHttpFailure,
  EvolutionTransportError,
} from './errors.js';

const providerMessageKeySchema = z
  .object({
    id: z.string().trim().min(1).max(512),
    remoteJid: z.string().trim().min(1).max(512).optional(),
    fromMe: z.boolean().optional(),
  })
  .passthrough();

const providerSendResponseSchema = z
  .object({
    key: providerMessageKeySchema,
    messageTimestamp: z.union([z.number().finite(), z.string().trim().min(1).max(64)]).optional(),
  })
  .passthrough();

const connectionStateResponseSchema = z
  .object({
    instance: z
      .object({
        instanceName: z.string().trim().min(1).max(160).optional(),
        state: z.string().trim().min(1).max(80).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const pairingResponseSchema = z
  .object({
    instance: z
      .object({
        instanceName: z.string().trim().min(1).max(160).optional(),
        state: z.string().trim().min(1).max(80).optional(),
        status: z.string().trim().min(1).max(80).optional(),
      })
      .passthrough()
      .optional(),
    qrcode: z
      .union([
        z.string().min(1).max(20_000),
        z
          .object({
            base64: z.string().min(1).max(20_000).optional(),
            code: z.string().min(1).max(20_000).optional(),
            pairingCode: z.string().min(1).max(20_000).optional(),
          })
          .passthrough(),
      ])
      .optional(),
  })
  .passthrough();

const instanceControlResponseSchema = z
  .object({
    instance: z
      .object({
        instanceName: z.string().trim().min(1).max(160).optional(),
        instanceId: z.string().trim().min(1).max(256).optional(),
        state: z.string().trim().min(1).max(80).optional(),
        status: z.string().trim().min(1).max(80).optional(),
      })
      .passthrough()
      .optional(),
    qrcode: pairingResponseSchema.shape.qrcode,
    status: z.string().trim().min(1).max(80).optional(),
    error: z.boolean().optional(),
    message: z.string().trim().min(1).max(1_000).optional(),
    response: z
      .object({ message: z.string().trim().min(1).max(1_000).optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

const markReadResponseSchema = z
  .object({
    message: z.string().trim().min(1).max(1_000),
    read: z.literal('success'),
  })
  .passthrough();

export interface EvolutionFetch {
  (input: string | URL, init?: RequestInit): Promise<Response>;
}

export interface EvolutionClientOptions {
  readonly baseUrl: string;
  /** Never logged; passed only in Evolution's documented `apikey` header. */
  readonly apiKey: string;
  readonly fetch?: EvolutionFetch;
  readonly requestTimeoutMs?: number;
}

export interface EvolutionSendTextRequest {
  readonly instanceName: string;
  readonly number: string;
  readonly text: string;
  readonly messageId: string;
}

export interface EvolutionSendMediaRequest {
  readonly instanceName: string;
  readonly number: string;
  readonly mediaType: 'image' | 'audio' | 'document';
  readonly media: string;
  readonly mimeType: string;
  readonly fileName?: string;
  readonly caption?: string;
  readonly messageId: string;
}

export interface EvolutionReadRequest {
  readonly instanceName: string;
  readonly id: string;
  readonly remoteJid: string;
  readonly fromMe: boolean;
}

export interface EvolutionWebhookRegistration {
  readonly instanceName: string;
  readonly url: string;
  readonly jwtSecret: string;
  readonly events: readonly ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'];
}

export interface EvolutionInstanceCreation {
  readonly instanceName: string;
}

export interface EvolutionSendReceipt {
  readonly providerMessageId: string;
  readonly acceptedAt: string;
}

function safeProviderCode(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const code = (value as Record<string, unknown>).code;
  return typeof code === 'string' ? code : undefined;
}

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

/**
 * Minimal HTTP client for the exact reviewed Evolution source route shapes. It never constructs a
 * transport from a model payload, starts pairing, or registers webhooks on construction.
 */
export class EvolutionClient {
  private readonly fetch: EvolutionFetch;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  public constructor(private readonly options: EvolutionClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.requestTimeoutMs ?? 15_000;
    this.baseUrl = normalizedBaseUrl(options.baseUrl);
  }

  public async sendText(input: EvolutionSendTextRequest): Promise<EvolutionSendReceipt> {
    const response = await this.requestJson(
      `/message/sendText/${encodeURIComponent(input.instanceName)}`,
      'POST',
      { number: input.number, text: input.text, messageId: input.messageId },
      providerSendResponseSchema,
    );
    return { providerMessageId: response.key.id, acceptedAt: new Date().toISOString() };
  }

  public async sendMedia(input: EvolutionSendMediaRequest): Promise<EvolutionSendReceipt> {
    const body: Record<string, unknown> = {
      number: input.number,
      mediatype: input.mediaType,
      media: input.media,
      mimetype: input.mimeType,
      messageId: input.messageId,
    };
    if (input.fileName) body.fileName = input.fileName;
    if (input.caption) body.caption = input.caption;
    const response = await this.requestJson(
      `/message/sendMedia/${encodeURIComponent(input.instanceName)}`,
      'POST',
      body,
      providerSendResponseSchema,
    );
    return { providerMessageId: response.key.id, acceptedAt: new Date().toISOString() };
  }

  public async sendWhatsAppAudio(input: EvolutionSendMediaRequest): Promise<EvolutionSendReceipt> {
    const response = await this.requestJson(
      `/message/sendWhatsAppAudio/${encodeURIComponent(input.instanceName)}`,
      'POST',
      { number: input.number, audio: input.media, messageId: input.messageId },
      providerSendResponseSchema,
    );
    return { providerMessageId: response.key.id, acceptedAt: new Date().toISOString() };
  }

  public async markMessageAsRead(input: EvolutionReadRequest): Promise<void> {
    await this.requestJson(
      `/chat/markMessageAsRead/${encodeURIComponent(input.instanceName)}`,
      'POST',
      { readMessages: [{ id: input.id, remoteJid: input.remoteJid, fromMe: input.fromMe }] },
      markReadResponseSchema,
    );
  }

  public async getConnectionState(instanceName: string): Promise<string | undefined> {
    const response = await this.requestJson(
      `/instance/connectionState/${encodeURIComponent(instanceName)}`,
      'GET',
      undefined,
      connectionStateResponseSchema,
    );
    return response.instance.state;
  }

  /** Sensitive result: only a future authenticated owner/admin UI may render this ephemerally. */
  public async requestPairing(
    instanceName: string,
  ): Promise<{ readonly qrCode: string | null; readonly state: string | null }> {
    const response = await this.requestJson(
      `/instance/connect/${encodeURIComponent(instanceName)}`,
      'GET',
      undefined,
      pairingResponseSchema,
    );
    const instance = response.instance;
    const state =
      instance &&
      typeof (instance.state ?? instance.status) === 'string' &&
      (instance.state ?? instance.status)!.trim().length > 0
        ? (instance.state ?? instance.status)!
        : null;
    const qrCode =
      typeof response.qrcode === 'string'
        ? response.qrcode
        : (response.qrcode?.base64 ??
          response.qrcode?.code ??
          response.qrcode?.pairingCode ??
          null);
    return { qrCode, state };
  }

  /**
   * Current reviewed source accepts these explicit Baileys-safe settings at POST /instance/create.
   * Pairing is deliberately a second, administrator-invoked operation so create never returns a
   * QR payload into an automated flow.
   */
  public async createInstance(input: EvolutionInstanceCreation): Promise<void> {
    await this.requestJson(
      '/instance/create',
      'POST',
      {
        instanceName: input.instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: false,
        groupsIgnore: true,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      },
      instanceControlResponseSchema,
    );
  }

  public async restartInstance(instanceName: string): Promise<void> {
    await this.requestJson(
      `/instance/restart/${encodeURIComponent(instanceName)}`,
      'POST',
      {},
      instanceControlResponseSchema,
    );
  }

  public async logoutInstance(instanceName: string): Promise<void> {
    await this.requestJson(
      `/instance/logout/${encodeURIComponent(instanceName)}`,
      'DELETE',
      undefined,
      instanceControlResponseSchema,
    );
  }

  public async deleteInstance(instanceName: string): Promise<void> {
    await this.requestJson(
      `/instance/delete/${encodeURIComponent(instanceName)}`,
      'DELETE',
      undefined,
      instanceControlResponseSchema,
    );
  }

  /**
   * Current reviewed source: POST /webhook/set/:instanceName with the camelCase `byEvents` field.
   * This method is intentionally unused by app startup; a future operator workflow must call it.
   */
  public async registerWebhook(input: EvolutionWebhookRegistration): Promise<void> {
    await this.requestJson(
      `/webhook/set/${encodeURIComponent(input.instanceName)}`,
      'POST',
      {
        webhook: {
          enabled: true,
          url: input.url,
          headers: { jwt_key: input.jwtSecret },
          byEvents: false,
          base64: false,
          events: [...input.events],
        },
      },
      instanceControlResponseSchema,
    );
  }

  private async requestJson<T>(
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body: Record<string, unknown> | undefined,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const url = new URL(path.replace(/^\//, ''), this.baseUrl).toString();
    try {
      const response = await this.fetch(url, {
        method,
        headers: {
          apikey: this.options.apiKey,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const rawText = await response.text();
      let parsed: unknown = undefined;
      if (rawText.length > 0) {
        try {
          parsed = JSON.parse(rawText) as unknown;
        } catch {
          if (response.ok) {
            throw new EvolutionTransportError(
              'Evolution returned an invalid JSON response.',
              'malformed_response',
              false,
            );
          }
        }
      }
      if (!response.ok) {
        throw classifyEvolutionHttpFailure({
          status: response.status,
          code: safeProviderCode(parsed),
        });
      }
      const result = schema.safeParse(parsed);
      if (!result.success) {
        throw new EvolutionTransportError(
          'Evolution returned an unexpected response schema.',
          'malformed_response',
          false,
        );
      }
      if (isProviderErrorResponse(result.data)) {
        throw new EvolutionTransportError(
          'Evolution reported a control-plane error response.',
          'provider_error_response',
          false,
        );
      }
      return result.data;
    } catch (error) {
      throw classifyEvolutionError(error);
    }
  }
}

function isProviderErrorResponse(value: unknown): boolean {
  return (
    typeof value === 'object' && value !== null && (value as { error?: unknown }).error === true
  );
}
