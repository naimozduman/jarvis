import { describe, expect, it } from 'vitest';

import {
  freeTierEligibilityForModel,
  inspectFreeTierCatalog,
  verifyConfiguredModels,
  verifyFromPublicCatalog,
} from './verify-vercel-ai-gateway-models.mjs';

function catalog(data) {
  return { object: 'list', data };
}

describe('Vercel AI Gateway Free Tier catalog verifier', () => {
  it('accepts an exact Free Tier eligibility tag even when provider list pricing is nonzero', () => {
    const result = verifyConfiguredModels(
      ['provider/model-a'],
      catalog([
        {
          id: 'provider/model-a',
          tags: ['free', 'reasoning', 'tool-use'],
          pricing: { input: '0.00000020', output: '0.00000100' },
        },
      ]),
    );

    expect(result).toMatchObject({
      catalogVerified: true,
      freeTierEligibleModelIds: ['provider/model-a'],
      verifiedModelIds: ['provider/model-a'],
      failures: [],
    });
  });

  it('rejects a catalog model that Vercel does not mark Free Tier eligible', () => {
    const result = verifyConfiguredModels(
      ['provider/paid-model'],
      catalog([
        {
          id: 'provider/paid-model',
          tags: ['reasoning'],
          pricing: { input: '0', output: '0' },
        },
      ]),
    );

    expect(result.verifiedModelIds).toEqual([]);
    expect(result.failures).toEqual([
      'provider/paid-model: not currently marked Free Tier eligible by Vercel metadata',
    ]);
  });

  it('rejects a missing or malformed Vercel eligibility field', () => {
    expect(freeTierEligibilityForModel({ id: 'provider/missing' })).toEqual({
      eligible: false,
      failure: 'missing Vercel Free Tier eligibility field `tags`',
    });
    expect(freeTierEligibilityForModel({ id: 'provider/malformed', tags: 'free' })).toEqual({
      eligible: false,
      failure: 'Vercel Free Tier eligibility field `tags` is malformed',
    });
    expect(
      freeTierEligibilityForModel({ id: 'provider/malformed-entry', tags: ['free', 1] }),
    ).toEqual({
      eligible: false,
      failure: 'Vercel Free Tier eligibility field `tags` is malformed',
    });
  });

  it('does not treat explicitly free pricing as evidence of Free Tier eligibility', () => {
    const result = verifyConfiguredModels(
      ['provider/zero-priced-only'],
      catalog([
        {
          id: 'provider/zero-priced-only',
          tags: ['tool-use'],
          pricing: { input: 0, output: 0 },
        },
      ]),
    );

    expect(result.verifiedModelIds).toEqual([]);
    expect(result.failures).toEqual([
      'provider/zero-priced-only: not currently marked Free Tier eligible by Vercel metadata',
    ]);
  });

  it('fails closed on a changed public catalog envelope and emits no eligible IDs', () => {
    const result = inspectFreeTierCatalog({ models: [{ id: 'provider/model-a', tags: ['free'] }] });

    expect(result).toEqual({
      catalogVerified: false,
      freeTierEligibleModelIds: [],
      failures: ['the public Vercel AI Gateway catalog has an unsupported schema'],
    });
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
      catalogVerified: false,
      configuredModelIds: ['provider/model-a'],
      freeTierEligibleModelIds: [],
      verifiedModelIds: [],
      failures: ['the public Vercel AI Gateway catalog could not be reached'],
    });
  });
});
