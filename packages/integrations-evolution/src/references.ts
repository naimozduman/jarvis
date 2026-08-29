import { createHash } from 'node:crypto';

/**
 * Converts a provider identifier into a deterministic opaque reference. Raw JIDs, instance IDs,
 * and provider message IDs are intentionally kept only inside the Evolution adapter while a
 * request is being normalized or sent. The canonical JARVIS transport records use these hashes.
 */
export function opaqueEvolutionReference(kind: string, value: string): string {
  const digest = createHash('sha256').update(`${kind}:${value}`, 'utf8').digest('hex');
  return `evo:${kind}:${digest}`;
}

export function ownerTargetReference(ownerPhone: string): string {
  return opaqueEvolutionReference('owner-target', normalizePhoneDigits(ownerPhone));
}

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function hasSafePhoneLength(value: string): boolean {
  return /^[0-9]{7,15}$/.test(value);
}
