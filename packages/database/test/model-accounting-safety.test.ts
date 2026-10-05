import { describe, expect, it } from 'vitest';

import { DrizzleBrainRepository } from '../src/brain-repository.js';
import type { JarvisDatabase } from '../src/client.js';

function safety(row: Record<string, unknown>) {
  const database = {
    select: () => ({ from: () => ({ where: async () => [row] }) }),
  } as unknown as JarvisDatabase;
  return new DrizzleBrainRepository(database).loadModelAccountingSafety({
    ownerId: 'synthetic-owner',
    modelId: 'synthetic-model',
  });
}

describe('durable accounting safety after pre-dispatch failure', () => {
  it.each(['not_configured', 'configuration_error'])(
    'does not quarantine a known non-dispatch: %s',
    async (status) => {
      await expect(
        safety({ status, inputTokens: null, admission: { allowed: false } }),
      ).resolves.toBe(true);
    },
  );
  it('allows credentials to recover after an admitted request never dispatched', async () => {
    await expect(
      safety({
        status: 'not_configured',
        inputTokens: null,
        admission: { allowed: true },
        accounting: { usageValid: false },
      }),
    ).resolves.toBe(true);
  });
  it('does not quarantine a completed run that predates admission and usage accounting', async () => {
    await expect(
      safety({
        status: 'completed',
        inputTokens: 2709,
        admission: null,
        accounting: null,
      }),
    ).resolves.toBe(true);
  });
  it.each(['failed', 'unavailable', 'incomplete_output'])(
    'keeps a non-completed legacy result without accounting blocked: %s',
    async (status) => {
      await expect(
        safety({
          status,
          inputTokens: null,
          admission: null,
          accounting: null,
        }),
      ).resolves.toBe(false);
    },
  );
  it('keeps a completed modern run without verified accounting blocked', async () => {
    await expect(
      safety({
        status: 'completed',
        inputTokens: 2709,
        admission: { allowed: true },
        accounting: null,
      }),
    ).resolves.toBe(false);
  });
  it('keeps unknown dispatched usage failures blocked', async () => {
    await expect(
      safety({
        status: 'unavailable',
        inputTokens: null,
        admission: { allowed: true },
        accounting: { usageValid: false },
      }),
    ).resolves.toBe(false);
  });
});
