import type { AuditEventInput } from '@jarvis/contracts';

import { redactSensitiveFields } from './redaction.js';

/**
 * Produces a safe audit record. State references remain identifiers/hashes rather than raw record
 * snapshots, and recursively sensitive metadata is redacted before persistence.
 */
export function createSafeAuditEvent(input: AuditEventInput): AuditEventInput {
  return {
    ...input,
    metadata: redactSensitiveFields(input.metadata),
  };
}
