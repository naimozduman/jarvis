import { describe, expect, it } from 'vitest';
import { loadApiEnvironment } from '@jarvis/config';
import { fastChatBenchmarkProfile } from '../src/casual-chat-benchmark-profile.js';

const route = {
  ...loadApiEnvironment({ APP_ENV: 'test' }).model.standard,
  model: 'openai/gpt-6-luna-fast',
  reasoningEffort: 'low' as const,
};
const endpoint = {
  provider_name: 'openai',
  context_length: 1050000,
  max_completion_tokens: 128000,
  supported_parameters: ['response_format', 'structured_outputs'],
  pricing: { prompt: '0.0000002', completion: '0.000001', request: '0', internal_reasoning: '0' },
};
const catalog = {
  data: { id: route.model, reasoning: { supported_efforts: ['low'] }, endpoints: [endpoint] },
};
const model = {
  id: route.model,
  pricing: {
    input: '0.0000002',
    output: '0.000001',
    regional: { us: { input_tiers: [{ cost: '0.00000044' }], output: '0.00000165' } },
  },
};

describe('evaluation-only fast model profiles', () => {
  it('includes regional/tier rates without changing output semantics or production admission', () => {
    const profile = fastChatBenchmarkProfile(route, catalog, model);
    expect(profile).toMatchObject({
      verificationState: 'verified',
      inputCostPerMillionUsd: 0.44,
      outputSemantics: 'total_including_reasoning',
      reasoningCountsAgainstControl: true,
    });
    // Ceiling rounds upward; IEEE-754 representation may add one nanodollar per million.
    expect(profile.outputCostPerMillionUsd).toBeGreaterThanOrEqual(1.65);
    expect(profile.outputCostPerMillionUsd).toBeLessThanOrEqual(1.65000001);
  });
  it.each([
    null,
    {
      data: {
        ...catalog.data,
        endpoints: [{ ...endpoint, supported_parameters: ['response_format'] }],
      },
    },
    { data: { ...catalog.data, endpoints: [{ ...endpoint, context_length: null }] } },
    { data: { ...catalog.data, endpoints: [{ ...endpoint, provider_name: 'unknown' }] } },
    { data: { ...catalog.data, reasoning: { supported_efforts: ['high'] } } },
  ])('fails closed for incomplete or incompatible capability data: %j', (value) => {
    expect(fastChatBenchmarkProfile(route, value, model).verificationState).toBe('unverified');
  });
  it('fails closed for missing/mismatched model price metadata', () => {
    expect(fastChatBenchmarkProfile(route, catalog, { id: 'other/model' }).verificationState).toBe(
      'unverified',
    );
    expect(
      fastChatBenchmarkProfile(route, catalog, { ...model, pricing: {} }).verificationState,
    ).toBe('unverified');
  });
});
