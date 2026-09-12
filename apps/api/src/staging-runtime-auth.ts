import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyRequest } from 'fastify';

import type { AuthenticationBoundary } from '@jarvis/security';
import { OwnerAuthorizationError } from '@jarvis/security';

function secretDigest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * This is deliberately shared only by the two fixed staging probes. Neither route accepts an
 * owner, provider, action, or arbitrary test instruction from an HTTP request.
 */
export function hasExpectedStagingBearerToken(
  value: string | undefined,
  expected: string,
): boolean {
  if (!value?.startsWith('Bearer ')) {
    return false;
  }
  const candidate = secretDigest(value.slice('Bearer '.length).trim());
  const known = secretDigest(expected);
  return timingSafeEqual(known, candidate);
}

export function normalizedRequestHeaders(
  headers: FastifyRequest['headers'],
): Readonly<Record<string, string | undefined>> {
  const normalized: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(headers)) {
    normalized[name] = typeof value === 'string' ? value : undefined;
  }
  return normalized;
}

export function createStagingRuntimeAuthentication(input: {
  readonly ownerId: string;
  readonly accessToken: string;
}): AuthenticationBoundary {
  return {
    async authenticate(context) {
      if (!hasExpectedStagingBearerToken(context.headers.authorization, input.accessToken)) {
        throw new OwnerAuthorizationError('The staging runtime route requires trusted access.');
      }
      return {
        ownerId: input.ownerId,
        // This narrow machine credential acts as its own trusted principal; it does not create a
        // public user/session path and can only invoke fixed staging probes.
        subjectId: input.ownerId,
        authMethod: 'trusted_client',
        scopes: ['events:ingest'],
      };
    },
  };
}
