import type {
  MessagingConnectionState,
  MessagingConnectionStatus,
  MessagingMarkReadRequest,
  MessagingMediaSendRequest,
  MessagingSendResult,
  MessagingTextSendRequest,
  MessagingTransport,
} from '@jarvis/contracts';

import type { EvolutionClient } from './client.js';
import { classifyEvolutionError, type EvolutionErrorCategory } from './errors.js';
import { EvolutionOutboundMapper } from './outbound-mapper.js';
import { opaqueEvolutionReference, ownerTargetReference } from './references.js';
import {
  verifyEvolutionVersionGate,
  type EvolutionVersionEvidence,
  type EvolutionVersionGateResult,
} from './version-gate.js';

export interface EvolutionProtectedMessageReference {
  readonly id: string;
  readonly remoteJid: string;
  readonly fromMe: boolean;
}

/**
 * Resolves short-lived, encrypted/provider-restricted references only in the adapter. JARVIS
 * canonical records and the Brain retain opaque references and can never reconstruct a JID.
 */
export interface EvolutionProtectedReferenceResolver {
  resolveMessage(input: {
    readonly connectionId: string;
    readonly messageReference: string;
    readonly conversationReference: string;
  }): Promise<EvolutionProtectedMessageReference | undefined>;
}

/** Media storage is provider-neutral; Evolution only receives a validated temporary source. */
export interface EvolutionMediaSourceResolver {
  resolveForDelivery(input: {
    readonly objectReference: string;
    readonly connectionId: string;
  }): Promise<string | undefined>;
}

export interface EvolutionMessagingTransportOptions {
  readonly client: EvolutionClient;
  readonly instanceName: string;
  readonly ownerPhone: string;
  readonly connectionId: string;
  readonly versionEvidence: EvolutionVersionEvidence;
  readonly now?: () => Date;
  readonly protectedReferences?: EvolutionProtectedReferenceResolver;
  readonly mediaSources?: EvolutionMediaSourceResolver;
}

function mapProviderConnectionState(value: string | undefined): MessagingConnectionState {
  switch (value?.trim().toLowerCase()) {
    case 'open':
    case 'connected':
      return 'connected';
    case 'connecting':
      return 'connecting';
    case 'reconnect':
    case 'reconnecting':
      return 'reconnecting';
    case 'degraded':
      return 'degraded';
    case 'close':
    case 'closed':
    case 'disconnected':
      return 'disconnected';
    case 'qr':
    case 'qrcode':
      return 'qr_required';
    case 'logout':
    case 'logged_out':
      return 'logged_out';
    case 'blocked':
      return 'blocked';
    default:
      return 'unknown';
  }
}

function failureResult(
  category: EvolutionErrorCategory,
  retryable: boolean,
  requiresReconciliation: boolean,
): MessagingSendResult {
  return {
    disposition: retryable ? 'retryable_failure' : 'terminal_failure',
    providerMessageReference: null,
    acceptedAt: null,
    errorCategory: category,
    requiresReconciliation,
  };
}

/**
 * The concrete Evolution implementation of the generic MessagingTransport. It has no database or
 * Brain dependency and can only send a pre-existing owner-bound delivery intent through its port.
 */
export class EvolutionMessagingTransport implements MessagingTransport {
  public readonly kind = 'evolution_whatsapp' as const;
  private readonly now: () => Date;
  private readonly mapper = new EvolutionOutboundMapper();
  private readonly expectedOwnerTarget: string;

  public constructor(private readonly options: EvolutionMessagingTransportOptions) {
    this.now = options.now ?? (() => new Date());
    this.expectedOwnerTarget = ownerTargetReference(options.ownerPhone);
  }

  public get versionGate(): EvolutionVersionGateResult {
    return verifyEvolutionVersionGate(this.options.versionEvidence);
  }

  public async sendText(input: MessagingTextSendRequest): Promise<MessagingSendResult> {
    if (!this.isBoundOwnerDelivery(input.connectionId, input.targetReference)) {
      return failureResult('validation', false, false);
    }
    const gate = this.versionGate;
    if (!gate.verified) {
      return {
        disposition: 'not_configured',
        providerMessageReference: null,
        acceptedAt: null,
        errorCategory: gate.reason,
        requiresReconciliation: false,
      };
    }
    try {
      const payload = this.mapper.text(input, this.options.ownerPhone);
      const receipt = await this.options.client.sendText({
        instanceName: this.options.instanceName,
        number: payload.number,
        text: payload.text,
        messageId: payload.messageId,
      });
      return {
        disposition: 'accepted',
        providerMessageReference: opaqueEvolutionReference('message', receipt.providerMessageId),
        acceptedAt: receipt.acceptedAt,
        errorCategory: null,
        requiresReconciliation: false,
      };
    } catch (error) {
      const classified = classifyEvolutionError(error);
      return failureResult(
        classified.category,
        classified.retryable,
        classified.requiresReconciliation,
      );
    }
  }

  public async sendImage(input: MessagingMediaSendRequest): Promise<MessagingSendResult> {
    return this.sendMedia(input, 'image');
  }

  public async sendAudio(input: MessagingMediaSendRequest): Promise<MessagingSendResult> {
    return this.sendMedia(input, 'audio');
  }

  public async sendDocument(input: MessagingMediaSendRequest): Promise<MessagingSendResult> {
    return this.sendMedia(input, 'document');
  }

  public async markRead(input: MessagingMarkReadRequest): Promise<void> {
    const gate = this.versionGate;
    if (!gate.verified || input.connectionId !== this.options.connectionId) {
      throw new Error('Evolution mark-read is not configured for this connection.');
    }
    const resolved = await this.options.protectedReferences?.resolveMessage({
      connectionId: input.connectionId,
      messageReference: input.messageReference,
      conversationReference: input.conversationReference,
    });
    if (!resolved) {
      throw new Error('Evolution mark-read requires a protected provider message reference.');
    }
    await this.options.client.markMessageAsRead({
      instanceName: this.options.instanceName,
      id: resolved.id,
      remoteJid: resolved.remoteJid,
      fromMe: resolved.fromMe,
    });
  }

  public async getConnectionStatus(input: {
    readonly connectionId: string;
  }): Promise<MessagingConnectionStatus> {
    const checkedAt = this.now().toISOString();
    const gate = this.versionGate;
    if (input.connectionId !== this.options.connectionId) {
      return {
        transport: this.kind,
        connectionId: input.connectionId,
        state: 'unknown',
        readiness: 'blocked',
        checkedAt,
        safeErrorCategory: 'connection_mismatch',
      };
    }
    if (!gate.verified) {
      return {
        transport: this.kind,
        connectionId: input.connectionId,
        state: gate.reason === 'vulnerable_baileys' ? 'incompatible_dependency' : 'blocked',
        readiness: gate.reason === 'vulnerable_baileys' ? 'blocked' : 'not_configured',
        checkedAt,
        safeErrorCategory: gate.reason,
      };
    }
    try {
      const state = mapProviderConnectionState(
        await this.options.client.getConnectionState(this.options.instanceName),
      );
      return {
        transport: this.kind,
        connectionId: input.connectionId,
        state,
        readiness:
          state === 'connected'
            ? 'connected'
            : state === 'degraded'
              ? 'degraded'
              : state === 'blocked' || state === 'logged_out'
                ? 'blocked'
                : 'reachable',
        checkedAt,
        safeErrorCategory: null,
      };
    } catch (error) {
      const classified = classifyEvolutionError(error);
      return {
        transport: this.kind,
        connectionId: input.connectionId,
        state: classified.category === 'authentication_failed' ? 'blocked' : 'degraded',
        readiness: 'degraded',
        checkedAt,
        safeErrorCategory: classified.category,
      };
    }
  }

  private async sendMedia(
    input: MessagingMediaSendRequest,
    expectedType: 'image' | 'audio' | 'document',
  ): Promise<MessagingSendResult> {
    if (!this.isBoundOwnerDelivery(input.connectionId, input.targetReference)) {
      return failureResult('validation', false, false);
    }
    const gate = this.versionGate;
    if (!gate.verified) {
      return {
        disposition: 'not_configured',
        providerMessageReference: null,
        acceptedAt: null,
        errorCategory: gate.reason,
        requiresReconciliation: false,
      };
    }
    const source = await this.options.mediaSources?.resolveForDelivery({
      objectReference: input.objectReference,
      connectionId: input.connectionId,
    });
    if (!source) {
      return failureResult('unsupported', false, false);
    }
    try {
      const payload = this.mapper.media(input, this.options.ownerPhone, source);
      if (payload.mediatype !== expectedType) {
        return failureResult('validation', false, false);
      }
      const receipt =
        expectedType === 'audio'
          ? await this.options.client.sendWhatsAppAudio({
              instanceName: this.options.instanceName,
              number: payload.number,
              mediaType: payload.mediatype,
              media: payload.media,
              mimeType: payload.mimetype,
              ...(payload.fileName ? { fileName: payload.fileName } : {}),
              ...(payload.caption ? { caption: payload.caption } : {}),
              messageId: payload.messageId,
            })
          : await this.options.client.sendMedia({
              instanceName: this.options.instanceName,
              number: payload.number,
              mediaType: payload.mediatype,
              media: payload.media,
              mimeType: payload.mimetype,
              ...(payload.fileName ? { fileName: payload.fileName } : {}),
              ...(payload.caption ? { caption: payload.caption } : {}),
              messageId: payload.messageId,
            });
      return {
        disposition: 'accepted',
        providerMessageReference: opaqueEvolutionReference('message', receipt.providerMessageId),
        acceptedAt: receipt.acceptedAt,
        errorCategory: null,
        requiresReconciliation: false,
      };
    } catch (error) {
      const classified = classifyEvolutionError(error);
      return failureResult(
        classified.category,
        classified.retryable,
        classified.requiresReconciliation,
      );
    }
  }

  private isBoundOwnerDelivery(connectionId: string, targetReference: string): boolean {
    return (
      connectionId === this.options.connectionId && targetReference === this.expectedOwnerTarget
    );
  }
}
