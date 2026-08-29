import type { MessagingAddress } from '@jarvis/contracts';

import {
  hasSafePhoneLength,
  normalizePhoneDigits,
  opaqueEvolutionReference,
  ownerTargetReference,
} from './references.js';

export type EvolutionSenderRejectionReason =
  | 'group_message'
  | 'broadcast_or_newsletter'
  | 'status_message'
  | 'malformed_sender'
  | 'unresolved_lid'
  | 'owner_mismatch';

export interface EvolutionInboundKey {
  readonly remoteJid: string | undefined;
  readonly remoteJidAlt?: string | undefined;
  readonly participant?: string | undefined;
  readonly participantAlt?: string | undefined;
}

/**
 * Provider payload aliases are only descriptive. A LID must be enrolled through a separate
 * authenticated owner/admin action before it can ever identify the owner on ingress.
 */
export interface EvolutionOwnerIdentityResolverOptions {
  readonly trustedOwnerLids?: readonly string[];
}

export interface AcceptedEvolutionSender {
  readonly accepted: true;
  readonly sender: MessagingAddress;
  /** Kept only inside the adapter to build a known-owner outbound request; never logged. */
  readonly ownerPhone: string;
  readonly targetReference: string;
}

export interface RejectedEvolutionSender {
  readonly accepted: false;
  readonly reason: EvolutionSenderRejectionReason;
  readonly senderReference: string | null;
}

export type EvolutionSenderResolution = AcceptedEvolutionSender | RejectedEvolutionSender;

function lower(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function isGroup(jid: string): boolean {
  return jid.endsWith('@g.us');
}

function isStatus(jid: string): boolean {
  return jid === 'status@broadcast';
}

function isBroadcastOrNewsletter(jid: string): boolean {
  return jid.endsWith('@broadcast') || jid.endsWith('@newsletter') || jid.includes('@newsletter.');
}

function phoneFromJid(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = lower(value);
  const separator = normalized.indexOf('@');
  if (separator <= 0) {
    return undefined;
  }
  const local = normalized.slice(0, separator).split(':', 1)[0] ?? '';
  const domain = normalized.slice(separator + 1);
  if (!['s.whatsapp.net', 'c.us', 'whatsapp.net'].includes(domain)) {
    return undefined;
  }
  const digits = normalizePhoneDigits(local);
  return hasSafePhoneLength(digits) ? digits : undefined;
}

function normalizedLid(value: string | undefined): string | undefined {
  const normalized = lower(value);
  return /^[a-z0-9._:-]{1,256}@lid$/.test(normalized) ? normalized : undefined;
}

function senderReference(value: string | undefined): string | null {
  return value ? opaqueEvolutionReference('sender', value) : null;
}

/**
 * Provider-specific identity resolver. It never returns an authorization decision to the Brain:
 * it only verifies whether an inbound direct message maps to the configured trusted owner.
 */
export class EvolutionOwnerIdentityResolver {
  private readonly ownerPhone: string;
  private readonly trustedOwnerLids: ReadonlySet<string>;

  public constructor(ownerPhone: string, options: EvolutionOwnerIdentityResolverOptions = {}) {
    const normalized = normalizePhoneDigits(ownerPhone);
    if (!hasSafePhoneLength(normalized)) {
      throw new Error('Evolution owner identity configuration is malformed.');
    }
    this.ownerPhone = normalized;
    const lids = (options.trustedOwnerLids ?? []).map((value) => normalizedLid(value));
    if (lids.some((value) => value === undefined)) {
      throw new Error('A trusted Evolution owner LID configuration is malformed.');
    }
    this.trustedOwnerLids = new Set(lids.filter((value): value is string => value !== undefined));
  }

  public resolve(key: EvolutionInboundKey): EvolutionSenderResolution {
    const remoteJid = lower(key.remoteJid);
    if (!remoteJid) {
      return { accepted: false, reason: 'malformed_sender', senderReference: null };
    }
    if (isGroup(remoteJid)) {
      return {
        accepted: false,
        reason: 'group_message',
        senderReference: senderReference(remoteJid),
      };
    }
    if (isStatus(remoteJid)) {
      return {
        accepted: false,
        reason: 'status_message',
        senderReference: senderReference(remoteJid),
      };
    }
    if (isBroadcastOrNewsletter(remoteJid)) {
      return {
        accepted: false,
        reason: 'broadcast_or_newsletter',
        senderReference: senderReference(remoteJid),
      };
    }

    const directPhone = phoneFromJid(remoteJid);
    const lid = normalizedLid(remoteJid);

    if (!directPhone && !lid) {
      return {
        accepted: false,
        reason: 'malformed_sender',
        senderReference: senderReference(remoteJid),
      };
    }
    if (directPhone && directPhone !== this.ownerPhone) {
      return {
        accepted: false,
        reason: 'owner_mismatch',
        senderReference: senderReference(remoteJid),
      };
    }

    if (lid && !this.trustedOwnerLids.has(lid)) {
      return {
        accepted: false,
        reason: 'unresolved_lid',
        senderReference: senderReference(remoteJid),
      };
    }

    const kind = lid ? 'lid' : remoteJid.endsWith('@s.whatsapp.net') ? 'phone' : 'alternate';
    return {
      accepted: true,
      sender: {
        transport: 'evolution_whatsapp',
        kind,
        reference: opaqueEvolutionReference('sender', remoteJid),
      },
      ownerPhone: this.ownerPhone,
      targetReference: ownerTargetReference(this.ownerPhone),
    };
  }
}
