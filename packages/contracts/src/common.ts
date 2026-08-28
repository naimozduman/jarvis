import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const utcTimestampSchema = z.string().datetime({ offset: true });
export const schemaVersionSchema = z.number().int().positive();
export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const correlationIdSchema = uuidSchema;
export const causationIdSchema = uuidSchema;

export type JsonObject = z.infer<typeof jsonObjectSchema>;

/**
 * Produces a deterministic JSON representation for hashes and idempotency material. It accepts
 * only JSON values on purpose: a Date, function, bigint, or undefined value is not safe to use as
 * durable decision material and must be normalized by the caller first.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON does not permit non-finite numbers.');
    }

    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Canonical JSON only permits plain object values.');
    }

    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${canonicalJson(nestedValue)}`)
      .join(',')}}`;
  }

  throw new TypeError(`Canonical JSON does not permit ${typeof value} values.`);
}
