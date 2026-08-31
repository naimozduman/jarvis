import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('Vercel runtime serverless boundary', () => {
  it('reconstructs invocation state from Neon and never composes a local worker, timer, or Evolution client', async () => {
    const source = await readFile(new URL('../src/vercel-runtime.ts', import.meta.url), 'utf8');

    expect(source).toContain('CanonicalOnlyDurableJobTransport');
    for (const forbidden of [
      'PgBossDurableJobTransport',
      'EvolutionClient',
      'setInterval',
      'setTimeout',
      '.listen(',
      'writeFile',
      'node:fs',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
