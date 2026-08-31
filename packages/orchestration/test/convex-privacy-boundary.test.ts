import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

async function source(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

function withoutComments(value: string): string {
  return value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Convex privacy boundary', () => {
  it('defines only opaque scheduling and transport-signal state, never private conversation data', async () => {
    const [schema, scheduler, signals, http] = await Promise.all([
      source('../../../convex/schema.ts'),
      source('../../../convex/scheduler.ts'),
      source('../../../convex/transportSignals.ts'),
      source('../../../convex/http.ts'),
    ]);
    const code = withoutComments(`${schema}\n${scheduler}\n${signals}\n${http}`).toLowerCase();

    for (const forbidden of [
      'messagebody',
      'message_body',
      'prompt',
      'constitution',
      'memory',
      'healthdata',
      'finance',
      'conversationhistory',
      'providercredential',
      'whatsappsession',
    ]) {
      expect(code).not.toContain(forbidden);
    }
    expect(signals).toContain('deliveryId: signal.deliveryId');
    expect(signals).toContain("state: 'pending' as const");
    expect(signals).not.toContain('intent: signal');
  });
});
