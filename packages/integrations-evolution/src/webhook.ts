import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  InboundMessageType,
  MessagingConnectionState,
  NormalizedTransportEvent,
} from '@jarvis/contracts';
import { z } from 'zod';

import type {
  EvolutionOwnerIdentityResolver,
  EvolutionSenderRejectionReason,
} from './identity-resolver.js';
import { opaqueEvolutionReference } from './references.js';

const acceptedWebhookEvents = [
  'MESSAGES_UPSERT',
  'MESSAGES_EDITED',
  'MESSAGES_UPDATE',
  'MESSAGES_DELETE',
  'CONNECTION_UPDATE',
] as const;

const evolutionWebhookEventSchema = z.enum(acceptedWebhookEvents);
const evolutionWebhookEnvelopeSchema = z
  .object({
    event: evolutionWebhookEventSchema,
    instance: z.string().trim().min(1).max(160),
    data: z.unknown(),
    date_time: z.string().trim().min(1).max(128),
    sender: z.string().trim().min(1).max(512).optional(),
    destination: z.string().trim().min(1).max(2_048).optional(),
    server_url: z.string().trim().min(1).max(2_048).optional(),
    /** Never retained, logged, used for authentication, or passed beyond this parser. */
    apikey: z.unknown().optional(),
  })
  .passthrough();

const evolutionMessageKeySchema = z
  .object({
    id: z.string().trim().min(1).max(512),
    remoteJid: z.string().trim().min(1).max(512),
    fromMe: z.boolean(),
    remoteJidAlt: z.string().trim().min(1).max(512).optional(),
    participant: z.string().trim().min(1).max(512).optional(),
    participantAlt: z.string().trim().min(1).max(512).optional(),
  })
  .passthrough();

const evolutionUpsertDataSchema = z
  .object({
    key: evolutionMessageKeySchema,
    message: z.record(z.string(), z.unknown()),
    messageType: z.string().trim().min(1).max(160),
    messageTimestamp: z.union([z.number().finite(), z.string().trim().min(1).max(64)]),
    contextInfo: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

type ParsedUpsertData = z.infer<typeof evolutionUpsertDataSchema>;

export interface ParsedEvolutionWebhook {
  readonly event: z.infer<typeof evolutionWebhookEventSchema>;
  readonly instanceName: string;
  readonly occurredAt: string;
  readonly data: unknown;
  /** Safe field names only. Unknown values are never persisted as raw provider payloads. */
  readonly unknownTopLevelFields: readonly string[];
}

export type EvolutionWebhookVerificationReason =
  | 'missing_authorization'
  | 'malformed_token'
  | 'invalid_signature'
  | 'unsupported_algorithm'
  | 'invalid_claims'
  | 'expired_token'
  | 'issued_at_outside_tolerance';

export type EvolutionWebhookVerificationResult =
  | { readonly verified: true }
  | { readonly verified: false; readonly reason: EvolutionWebhookVerificationReason };

export interface EvolutionWebhookVerifierOptions {
  readonly secret: string;
  readonly now?: () => Date;
  readonly clockSkewSeconds?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeJsonBase64Url(value: string): unknown {
  const decoded = Buffer.from(value, 'base64url').toString('utf8');
  return JSON.parse(decoded) as unknown;
}

function equalSignature(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected, 'utf8');
  const actualBytes = Buffer.from(actual, 'utf8');
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

/**
 * Current reviewed Evolution source does not send a generic body HMAC for ordinary webhooks. Its
 * supported per-instance mechanism is an HS256 JWT generated from `jwt_key` in webhook headers.
 * This verifier enforces that precise protocol and rejects algorithm confusion/floating claims.
 */
export class EvolutionWebhookVerifier {
  private readonly now: () => Date;
  private readonly clockSkewSeconds: number;

  public constructor(private readonly options: EvolutionWebhookVerifierOptions) {
    this.now = options.now ?? (() => new Date());
    this.clockSkewSeconds = options.clockSkewSeconds ?? 60;
  }

  public verify(authorization: string | undefined): EvolutionWebhookVerificationResult {
    if (!authorization?.startsWith('Bearer ')) {
      return { verified: false, reason: 'missing_authorization' };
    }
    const token = authorization.slice('Bearer '.length).trim();
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
      return { verified: false, reason: 'malformed_token' };
    }
    const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac('sha256', this.options.secret)
      .update(signingInput, 'utf8')
      .digest('base64url');
    if (!equalSignature(expectedSignature, encodedSignature)) {
      return { verified: false, reason: 'invalid_signature' };
    }

    try {
      const header = decodeJsonBase64Url(encodedHeader);
      const payload = decodeJsonBase64Url(encodedPayload);
      if (!isRecord(header) || header.alg !== 'HS256') {
        return { verified: false, reason: 'unsupported_algorithm' };
      }
      if (!isRecord(payload) || payload.app !== 'evolution' || payload.action !== 'webhook') {
        return { verified: false, reason: 'invalid_claims' };
      }
      const issuedAt = payload.iat;
      const expiresAt = payload.exp;
      if (typeof issuedAt !== 'number' || typeof expiresAt !== 'number') {
        return { verified: false, reason: 'invalid_claims' };
      }
      const nowSeconds = Math.floor(this.now().getTime() / 1_000);
      if (expiresAt < nowSeconds - this.clockSkewSeconds) {
        return { verified: false, reason: 'expired_token' };
      }
      if (
        issuedAt > nowSeconds + this.clockSkewSeconds ||
        issuedAt < nowSeconds - 660 - this.clockSkewSeconds ||
        expiresAt <= issuedAt
      ) {
        return { verified: false, reason: 'issued_at_outside_tolerance' };
      }
      return { verified: true };
    } catch {
      return { verified: false, reason: 'malformed_token' };
    }
  }
}

export class EvolutionWebhookParser {
  public parse(input: unknown): ParsedEvolutionWebhook {
    const parsed = evolutionWebhookEnvelopeSchema.parse(input);
    const occurredAt = new Date(parsed.date_time);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new Error('Evolution webhook date_time is invalid.');
    }
    const knownFields = new Set([
      'event',
      'instance',
      'data',
      'date_time',
      'sender',
      'destination',
      'server_url',
      'apikey',
    ]);
    return {
      event: parsed.event,
      instanceName: parsed.instance,
      occurredAt: occurredAt.toISOString(),
      data: parsed.data,
      unknownTopLevelFields: Object.keys(parsed)
        .filter((field) => !knownFields.has(field))
        .sort(),
    };
  }
}

export type EvolutionMappingRejectionReason =
  | EvolutionSenderRejectionReason
  | 'outbound_echo'
  | 'protocol_or_history'
  | 'history_sync'
  | 'malformed_payload'
  | 'unsupported_event';

export type EvolutionWebhookMappingResult =
  | { readonly accepted: true; readonly event: NormalizedTransportEvent }
  | {
      readonly accepted: false;
      readonly reason: EvolutionMappingRejectionReason;
      readonly providerEventReference: string | null;
      readonly instanceReference: string;
      /** Opaque only; raw sender identity never leaves this adapter. */
      readonly senderReference?: string | null;
    };

function record(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function stringValue(value: unknown, maximum = 8_000): string | null {
  return typeof value === 'string' && value.length <= maximum ? value : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  const object = record(value);
  if (object && typeof object.low === 'number' && Number.isFinite(object.low) && object.low >= 0) {
    return Math.floor(object.low);
  }
  return null;
}

function messageNode(data: ParsedUpsertData, key: string): Record<string, unknown> | undefined {
  return record(data.message[key]);
}

function mapMessageType(data: ParsedUpsertData): InboundMessageType {
  if (data.message.conversation !== undefined || data.message.extendedTextMessage !== undefined) {
    return 'text';
  }
  if (data.message.imageMessage !== undefined) return 'image';
  if (data.message.audioMessage !== undefined) return 'audio';
  if (
    data.message.documentMessage !== undefined ||
    data.message.documentWithCaptionMessage !== undefined
  ) {
    return 'document';
  }
  if (data.message.locationMessage !== undefined) return 'location';
  if (
    data.message.contactMessage !== undefined ||
    data.message.contactsArrayMessage !== undefined
  ) {
    return 'contact';
  }
  if (data.message.reactionMessage !== undefined) return 'reaction';
  return 'unsupported';
}

function suspiciousProtocolContentReason(
  data: ParsedUpsertData,
): 'protocol_or_history' | 'history_sync' | null {
  if ('historySyncNotification' in data.message || /history|sync/i.test(data.messageType)) {
    return 'history_sync';
  }
  const prohibitedMessageKeys = [
    'protocolMessage',
    'placeholderMessage',
    'historySyncNotification',
    'senderKeyDistributionMessage',
    'editedMessage',
    'requestPaymentMessage',
  ];
  if (
    'requestId' in data ||
    prohibitedMessageKeys.some((key) => key in data.message) ||
    /protocol|placeholder|resend/i.test(data.messageType)
  ) {
    return 'protocol_or_history';
  }
  return null;
}

function textFromMessage(data: ParsedUpsertData, type: InboundMessageType): string | null {
  if (type === 'text') {
    const conversation = stringValue(data.message.conversation);
    if (conversation !== null) return conversation;
    return stringValue(record(data.message.extendedTextMessage)?.text);
  }
  if (type === 'image') return stringValue(messageNode(data, 'imageMessage')?.caption);
  if (type === 'document') {
    const document =
      messageNode(data, 'documentMessage') ??
      record(record(data.message.documentWithCaptionMessage)?.message)?.documentMessage;
    return stringValue(record(document)?.caption);
  }
  return null;
}

function mediaFromMessage(data: ParsedUpsertData, type: InboundMessageType) {
  const documentWithCaption = record(data.message['documentWithCaptionMessage']);
  const captionedDocument = record(record(documentWithCaption?.['message'])?.['documentMessage']);
  const node: Record<string, unknown> | undefined =
    type === 'image'
      ? messageNode(data, 'imageMessage')
      : type === 'audio'
        ? messageNode(data, 'audioMessage')
        : type === 'document'
          ? (messageNode(data, 'documentMessage') ?? captionedDocument)
          : undefined;
  if (!node || (type !== 'image' && type !== 'audio' && type !== 'document')) {
    return null;
  }
  const directPath = stringValue(node['directPath'], 2_048);
  return {
    mediaType: type,
    mimeType: stringValue(node['mimetype'], 160),
    byteLength: numberValue(node['fileLength']),
    fileName: type === 'document' ? stringValue(node['fileName'], 512) : null,
    providerMediaReference: directPath
      ? opaqueEvolutionReference('media', directPath)
      : opaqueEvolutionReference('media-message', data.key.id),
  } as const;
}

function replyToFromMessage(data: ParsedUpsertData) {
  const messageContext = (key: string): Record<string, unknown> | undefined =>
    record(record(data.message[key])?.['contextInfo']);
  const context: Record<string, unknown> | undefined =
    record(data.contextInfo) ??
    messageContext('extendedTextMessage') ??
    messageContext('imageMessage') ??
    messageContext('audioMessage') ??
    messageContext('documentMessage');
  if (!context) {
    return null;
  }
  const stanzaId = stringValue(context['stanzaId'], 512);
  if (!stanzaId) {
    return null;
  }
  const participant = stringValue(context['participant'], 512);
  const remoteJid = stringValue(context['remoteJid'], 512);
  return {
    providerMessageReference: opaqueEvolutionReference('message', stanzaId),
    senderReference: participant ? opaqueEvolutionReference('sender', participant) : null,
    conversationReference: remoteJid ? opaqueEvolutionReference('conversation', remoteJid) : null,
  };
}

function toDeliveryState(
  value: unknown,
): 'sent' | 'delivered' | 'read' | 'failed_retryable' | null {
  const status = stringValue(value, 80)?.toUpperCase();
  if (!status) return null;
  if (['SERVER_ACK', 'PENDING', 'SENT'].includes(status)) return 'sent';
  if (['DELIVERY_ACK', 'DELIVERED'].includes(status)) return 'delivered';
  if (['READ', 'PLAYED'].includes(status)) return 'read';
  if (['ERROR', 'FAILED'].includes(status)) return 'failed_retryable';
  return null;
}

function toConnectionState(value: unknown): MessagingConnectionState {
  const state = stringValue(value, 80)?.toLowerCase();
  if (state === 'open' || state === 'connected') return 'connected';
  if (state === 'connecting') return 'connecting';
  if (state === 'reconnecting' || state === 'reconnect') return 'reconnecting';
  if (state === 'degraded') return 'degraded';
  if (state === 'close' || state === 'closed' || state === 'disconnected') return 'disconnected';
  if (state === 'qr' || state === 'qrcode') return 'qr_required';
  if (state === 'logged_out' || state === 'logout') return 'logged_out';
  if (state === 'blocked') return 'blocked';
  return 'unknown';
}

function eventIdempotencyKey(instanceName: string, event: string, providerId: string): string {
  return `evolution:${opaqueEvolutionReference('idempotency', `${instanceName}:${event}:${providerId}`)}`;
}

/**
 * Converts strict, verified Evolution payloads into provider-neutral events. It rejects protocol,
 * history, resend, group, broadcast, status, self-echo, malformed, and unallowlisted traffic
 * before anything can enter the canonical ingress/Brain pipeline.
 */
export class EvolutionMessageMapper {
  public constructor(private readonly ownerResolver: EvolutionOwnerIdentityResolver) {}

  public map(input: ParsedEvolutionWebhook): EvolutionWebhookMappingResult {
    const instanceReference = opaqueEvolutionReference('instance', input.instanceName);
    if (input.event === 'MESSAGES_UPSERT') {
      return this.mapUpsert(input, instanceReference);
    }
    if (input.event === 'MESSAGES_EDITED' || input.event === 'MESSAGES_DELETE') {
      return this.mapMessageMutation(input, instanceReference);
    }
    if (input.event === 'MESSAGES_UPDATE') {
      return this.mapDeliveryUpdate(input, instanceReference);
    }
    if (input.event === 'CONNECTION_UPDATE') {
      return this.mapConnectionUpdate(input, instanceReference);
    }
    return {
      accepted: false,
      reason: 'unsupported_event',
      providerEventReference: null,
      instanceReference,
      senderReference: null,
    };
  }

  private mapUpsert(
    input: ParsedEvolutionWebhook,
    instanceReference: string,
  ): EvolutionWebhookMappingResult {
    const parsed = evolutionUpsertDataSchema.safeParse(input.data);
    if (!parsed.success) {
      return {
        accepted: false,
        reason: 'malformed_payload',
        providerEventReference: null,
        instanceReference,
        senderReference: null,
      };
    }
    const data = parsed.data;
    const providerEventReference = opaqueEvolutionReference('message', data.key.id);
    const senderReference = opaqueEvolutionReference('sender', data.key.remoteJid);
    if (data.key.fromMe) {
      return {
        accepted: false,
        reason: 'outbound_echo',
        providerEventReference,
        instanceReference,
        senderReference,
      };
    }
    const suspiciousReason = suspiciousProtocolContentReason(data);
    if (suspiciousReason) {
      return {
        accepted: false,
        reason: suspiciousReason,
        providerEventReference,
        instanceReference,
        senderReference,
      };
    }
    const resolved = this.ownerResolver.resolve(data.key);
    if (!resolved.accepted) {
      return {
        accepted: false,
        reason: resolved.reason,
        providerEventReference,
        instanceReference,
        senderReference: resolved.senderReference,
      };
    }
    const messageType = mapMessageType(data);
    if (messageType === 'unsupported') {
      return {
        accepted: false,
        reason: 'unsupported_event',
        providerEventReference,
        instanceReference,
        senderReference,
      };
    }
    const conversationReference = opaqueEvolutionReference('conversation', data.key.remoteJid);
    const event: NormalizedTransportEvent = {
      kind: 'message.received',
      transport: 'evolution_whatsapp',
      instanceReference,
      providerEventReference,
      idempotencyKey: eventIdempotencyKey(input.instanceName, input.event, data.key.id),
      occurredAt: input.occurredAt,
      schemaVersion: 1,
      message: {
        transport: 'evolution_whatsapp',
        instanceReference,
        providerMessageReference: providerEventReference,
        conversationReference,
        sender: resolved.sender,
        messageType,
        occurredAt: input.occurredAt,
        text: textFromMessage(data, messageType),
        replyTo: replyToFromMessage(data),
        media: mediaFromMessage(data, messageType),
        deliveryState: toDeliveryState(data.status),
        metadata: {
          source: stringValue(data.source, 160),
          hasQuotedMessage: replyToFromMessage(data) !== null,
          hasMedia: mediaFromMessage(data, messageType) !== null,
        },
      },
      delivery: null,
      connection: null,
      metadata: {
        providerEvent: input.event,
        unknownTopLevelFieldCount: input.unknownTopLevelFields.length,
      },
    };
    return { accepted: true, event };
  }

  private mapMessageMutation(
    input: ParsedEvolutionWebhook,
    instanceReference: string,
  ): EvolutionWebhookMappingResult {
    const data = record(input.data);
    const key = data ? evolutionMessageKeySchema.safeParse(data.key ?? data) : undefined;
    if (!key?.success) {
      return {
        accepted: false,
        reason: 'malformed_payload',
        providerEventReference: null,
        instanceReference,
        senderReference: null,
      };
    }
    const providerEventReference = opaqueEvolutionReference('message', key.data.id);
    const resolved = this.ownerResolver.resolve(key.data);
    if (!resolved.accepted) {
      return {
        accepted: false,
        reason: resolved.reason,
        providerEventReference,
        instanceReference,
        senderReference: resolved.senderReference,
      };
    }
    return {
      accepted: true,
      event: {
        kind: input.event === 'MESSAGES_EDITED' ? 'message.edited' : 'message.deleted',
        transport: 'evolution_whatsapp',
        instanceReference,
        providerEventReference,
        idempotencyKey: eventIdempotencyKey(input.instanceName, input.event, key.data.id),
        occurredAt: input.occurredAt,
        schemaVersion: 1,
        message: {
          transport: 'evolution_whatsapp',
          instanceReference,
          providerMessageReference: providerEventReference,
          conversationReference: opaqueEvolutionReference('conversation', key.data.remoteJid),
          sender: resolved.sender,
          messageType: input.event === 'MESSAGES_EDITED' ? 'message_edit' : 'message_delete',
          occurredAt: input.occurredAt,
          text: null,
          replyTo: null,
          media: null,
          deliveryState: null,
          metadata: {},
        },
        delivery: null,
        connection: null,
        metadata: { providerEvent: input.event },
      },
    };
  }

  private mapDeliveryUpdate(
    input: ParsedEvolutionWebhook,
    instanceReference: string,
  ): EvolutionWebhookMappingResult {
    const data = record(input.data);
    const key = data ? evolutionMessageKeySchema.safeParse(data.key ?? data) : undefined;
    const status = toDeliveryState(data?.status ?? record(data?.update)?.status);
    if (!key?.success || !status) {
      return {
        accepted: false,
        reason: 'malformed_payload',
        providerEventReference: null,
        instanceReference,
        senderReference: null,
      };
    }
    const providerEventReference = opaqueEvolutionReference('message', key.data.id);
    return {
      accepted: true,
      event: {
        kind: 'delivery.updated',
        transport: 'evolution_whatsapp',
        instanceReference,
        providerEventReference,
        idempotencyKey: eventIdempotencyKey(
          input.instanceName,
          input.event,
          `${key.data.id}:${status}:${input.occurredAt}`,
        ),
        occurredAt: input.occurredAt,
        schemaVersion: 1,
        message: null,
        delivery: {
          transport: 'evolution_whatsapp',
          instanceReference,
          providerMessageReference: providerEventReference,
          state: status,
          occurredAt: input.occurredAt,
          metadata: {},
        },
        connection: null,
        metadata: { providerEvent: input.event },
      },
    };
  }

  private mapConnectionUpdate(
    input: ParsedEvolutionWebhook,
    instanceReference: string,
  ): EvolutionWebhookMappingResult {
    const data = record(input.data);
    if (!data) {
      return {
        accepted: false,
        reason: 'malformed_payload',
        providerEventReference: null,
        instanceReference,
        senderReference: null,
      };
    }
    const state = toConnectionState(data.state ?? record(data.instance)?.state);
    const providerEventReference = opaqueEvolutionReference(
      'connection-event',
      `${input.instanceName}:${state}:${input.occurredAt}`,
    );
    return {
      accepted: true,
      event: {
        kind: 'connection.updated',
        transport: 'evolution_whatsapp',
        instanceReference,
        providerEventReference,
        idempotencyKey: eventIdempotencyKey(
          input.instanceName,
          input.event,
          `${state}:${input.occurredAt}`,
        ),
        occurredAt: input.occurredAt,
        schemaVersion: 1,
        message: null,
        delivery: null,
        connection: {
          transport: 'evolution_whatsapp',
          instanceReference,
          state,
          occurredAt: input.occurredAt,
          errorCategory: null,
          metadata: {},
        },
        metadata: { providerEvent: input.event },
      },
    };
  }
}

export { evolutionWebhookEnvelopeSchema };
