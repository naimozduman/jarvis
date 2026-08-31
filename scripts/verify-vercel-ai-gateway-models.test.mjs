import { describe, expect, it } from 'vitest';

import {
  hasZeroPrice,
  verifyConfiguredModels,
  verifyFromPublicCatalog,
} from './verify-vercel-ai-gateway-models.mjs';

describe('zero-cost AI Gateway catalog verifier', () => {
  it('accepts only explicit numeric zero prices and rejects unknown pricing leaves', () => {
    expect(hasZeroPrice({ pricing: { input: 0, output: 0 } })).toBe(true);
    expect(hasZeroPrice({ pricing: { input: 0, output: 'unknown' } })).toBe(false);
    expect(hasZeroPrice({ pricing: { input: 0, output: null } })).toBe(false);
    expect(hasZeroPrice({ pricing: { input: 0, output: 0.001 } })).toBe(false);
  });

  it('fails closed when a configured model is absent, not tagged free, or has unverified pricing', () => {
    const result = verifyConfiguredModels(['provider/model-a', 'provider/model-b'], {
      data: [
        { id: 'provider/model-a', tags: ['free'], pricing: { input: 0, output: 0 } },
        { id: 'provider/model-b', tags: ['free'], pricing: { input: 0, output: 'unknown' } },
      ],
    });
    expect(result.verifiedModelIds).toEqual([]);
    expect(result.failures).toEqual(['provider/model-b: catalog pricing is not verified as zero']);
  });

  it('reports catalog unavailability explicitly without permitting a model request', async () => {
    const result = await verifyFromPublicCatalog({
      environment: {
        JARVIS_ZERO_COST_MODE: 'true',
        JARVIS_VERCEL_AI_GATEWAY_FAST_MODEL: 'provider/model-a',
      },
      fetchImplementation: async () => {
        throw new Error('offline');
      },
    });

    expect(result).toEqual({
      skipped: false,
      verifiedModelIds: [],
      failures: ['the public Vercel AI Gateway catalog could not be reached'],
    });
  });
});
