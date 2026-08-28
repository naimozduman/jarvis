import { createHmac, timingSafeEqual } from 'node:crypto';

export function deriveTokenDigest(token: string, serverPepper: string): Buffer {
  return createHmac('sha256', serverPepper).update(token, 'utf8').digest();
}

/**
 * Compares fixed-length digests. Callers must derive digests with the same established algorithm;
 * this helper intentionally does not log malformed values or token material.
 */
export function constantTimeDigestEquals(expected: Buffer, candidate: Buffer): boolean {
  if (expected.length !== candidate.length) {
    return false;
  }

  return timingSafeEqual(expected, candidate);
}

export function constantTimeTokenEquals(
  storedDigest: Buffer,
  candidateToken: string,
  serverPepper: string,
): boolean {
  return constantTimeDigestEquals(storedDigest, deriveTokenDigest(candidateToken, serverPepper));
}
