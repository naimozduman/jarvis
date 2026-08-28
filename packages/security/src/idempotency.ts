import { createHash } from 'node:crypto';

import { canonicalJson } from '@jarvis/contracts';

export function createIdempotencyKey(
  namespace: string,
  stableInput: Readonly<Record<string, unknown>>,
): string {
  const digest = createHash('sha256')
    .update(`${namespace}:${canonicalJson(stableInput)}`, 'utf8')
    .digest('hex');

  return `${namespace}:${digest}`;
}

export function createStateHash(value: Readonly<Record<string, unknown>>): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
