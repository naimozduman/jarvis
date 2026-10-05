import type { OpenAiModelRouteConfiguration } from '@jarvis/config';
import type { ModelAdmissionProfile } from '@jarvis/contracts';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const positiveInteger = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;

function maximumRate(pricing: unknown, key: 'prompt' | 'completion'): number | null {
  if (!record(pricing)) return null;
  const values: unknown[] = [pricing[key]];
  const tiers = pricing[`${key}_tiers`];
  if (tiers !== undefined) {
    if (!Array.isArray(tiers)) return null;
    for (const tier of tiers) {
      if (!record(tier)) return null;
      values.push(tier.cost);
    }
  }
  const rates = values.map((value) =>
    typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)
      ? Number(value)
      : typeof value === 'number'
        ? value
        : NaN,
  );
  return rates.every((value) => Number.isFinite(value) && value >= 0)
    ? Math.ceil(Math.max(...rates) * 1_000_000 * 1_000_000_000) / 1_000_000_000
    : null;
}

function baseProfile(route: OpenAiModelRouteConfiguration): ModelAdmissionProfile {
  return {
    version: 'model-admission-v3-20260929',
    modelId: route.model,
    providerRoute: [],
    contextWindowTokens: null,
    maximumOutputTokens: null,
    inputCostPerMillionUsd: null,
    outputCostPerMillionUsd: null,
    reasoningEffort: route.reasoningEffort,
    requestedOutputControl: 'max_output_tokens',
    requestedOutputTokens: route.maxOutputTokens,
    outputSemantics: 'unverified',
    reasoningCountsAgainstControl: null,
    verificationState: 'unverified',
    verificationReason: 'Verified model admission metadata is unavailable.',
    verifiedAt: new Date().toISOString(),
    nativeCounter: 'none',
    sources: [],
  };
}

/** Default Gateway routing stays intact: take the smallest window and highest rate of every endpoint. */
export function profileFromGatewayCatalog(
  route: OpenAiModelRouteConfiguration,
  catalog: unknown,
): ModelAdmissionProfile {
  const profile = baseProfile(route);
  profile.sources = [`https://ai-gateway.vercel.sh/v1/models/${route.model}/endpoints`];
  if (
    !record(catalog) ||
    !record(catalog.data) ||
    !Array.isArray(catalog.data.endpoints) ||
    catalog.data.endpoints.length === 0
  )
    return profile;
  const endpoints = catalog.data.endpoints;
  if (!endpoints.every(record)) return profile;
  const contexts = endpoints.map((endpoint) =>
    positiveInteger(endpoint.context_length ?? endpoint.context_window),
  );
  const outputs = endpoints.map((endpoint) =>
    positiveInteger(endpoint.max_completion_tokens ?? endpoint.max_tokens),
  );
  const prices = endpoints.flatMap((endpoint) => {
    const variants: unknown[] = [endpoint.pricing];
    if (Array.isArray(endpoint.inference_regions)) {
      for (const region of endpoint.inference_regions)
        variants.push(record(region) ? region.pricing : null);
    }
    for (const pricing of [...variants]) {
      if (record(pricing) && record(pricing.service_tiers)) {
        for (const tier of Object.values(pricing.service_tiers)) {
          variants.push(tier);
          if (record(tier) && tier.long_context !== undefined) variants.push(tier.long_context);
        }
      }
    }
    return variants;
  });
  const inputs = prices.map((pricing) => maximumRate(pricing, 'prompt'));
  const outputRates = prices.map((pricing) => maximumRate(pricing, 'completion'));
  profile.providerRoute = endpoints.map((endpoint) => String(endpoint.provider_name));
  profile.contextWindowTokens = contexts.every((value) => value !== null)
    ? Math.min(...contexts)
    : null;
  profile.maximumOutputTokens = outputs.every((value) => value !== null)
    ? Math.min(...outputs)
    : null;
  profile.inputCostPerMillionUsd = inputs.every((value) => value !== null)
    ? Math.max(...inputs)
    : null;
  profile.outputCostPerMillionUsd = outputRates.every((value) => value !== null)
    ? Math.max(...outputRates)
    : null;
  const strict = endpoints.every((endpoint) => {
    const parameters = endpoint.supported_parameters;
    return (
      Array.isArray(parameters) &&
      ['structured_outputs', 'response_format'].every((parameter) => parameters.includes(parameter))
    );
  });
  const reasoning =
    record(catalog.data.reasoning) &&
    Array.isArray(catalog.data.reasoning.supported_efforts) &&
    catalog.data.reasoning.supported_efforts.includes(route.reasoningEffort);
  const extraFeesKnown = endpoints.every((endpoint) => {
    const pricing = endpoint.pricing;
    return (
      record(pricing) &&
      ['request', 'internal_reasoning'].every(
        (key) => pricing[key] !== undefined && Number(pricing[key]) === 0,
      )
    );
  });
  if (route.model === 'meta/muse-spark-1.3-contributor') {
    profile.sources.push(
      'https://vercel.com/ai-gateway/models/muse-spark-1.3-contributor',
      'https://dev.meta.ai/docs/protocols/responses',
      'https://dev.meta.ai/docs/reasoning',
      'recorded-synthetic-generation:gen_01M3PR6KZXN6H0AZY6NYPNBKA6',
    );
    if (
      catalog.data.id === route.model &&
      profile.providerRoute.every((provider) => provider === 'meta') &&
      strict &&
      reasoning &&
      extraFeesKnown &&
      profile.contextWindowTokens !== null &&
      profile.maximumOutputTokens !== null &&
      profile.inputCostPerMillionUsd !== null &&
      profile.outputCostPerMillionUsd !== null
    ) {
      // Bound spend by the largest possible output across routes; the requested cap is not trusted.
      profile.maximumOutputTokens = Math.max(
        ...outputs.filter((value): value is number => value !== null),
      );
      profile.outputSemantics = 'provider_maximum_shared_context';
      profile.reasoningCountsAgainstControl = null;
      profile.verificationState = 'verified';
      profile.verificationReason =
        'Meta documents combined reasoning/visible max_output_tokens, but recorded total 2599 exceeded requested 2500. Retain control without trusting it: use catalog maximum output for cost and provider-enforced shared input/output context for capacity.';
    }
    return profile;
  }

  if (
    catalog.data.id === route.model &&
    route.model === 'openai/gpt-6-luna' &&
    profile.providerRoute.every((provider) => ['openai', 'azure', 'bedrock'].includes(provider)) &&
    strict &&
    reasoning &&
    extraFeesKnown
  ) {
    profile.outputSemantics = 'total_including_reasoning';
    profile.reasoningCountsAgainstControl = true;
    profile.verificationState = 'verified';
    profile.verificationReason =
      'Gateway Luna documents a combined output/reasoning cap; known Azure/Bedrock/OpenAI routes, strict schema and reasoning support checked against live catalog. Recorded Luna usage stayed within the cap.';
    profile.sources.push('https://vercel.com/ai-gateway/models/gpt-6-luna');
  }
  return profile;
}

export type GatewayAdmissionProfileSource = (
  route: OpenAiModelRouteConfiguration,
) => Promise<ModelAdmissionProfile>;
export const loadGatewayAdmissionProfile: GatewayAdmissionProfileSource = async (route) => {
  if (!['openai/gpt-6-luna', 'meta/muse-spark-1.3-contributor'].includes(route.model))
    return baseProfile(route);
  try {
    const response = await fetch(
      `https://ai-gateway.vercel.sh/v1/models/${route.model}/endpoints`,
      { signal: AbortSignal.timeout(10000) },
    );
    return response.ok
      ? profileFromGatewayCatalog(route, await response.json())
      : baseProfile(route);
  } catch {
    return baseProfile(route);
  }
};

/** Existing direct credentials only. No Gateway request can switch to this route for counting. */
export function directAdmissionProfile(
  route: OpenAiModelRouteConfiguration,
): ModelAdmissionProfile {
  const profile = baseProfile(route);
  if (route.model !== 'gpt-6-luna') return profile;
  return {
    ...profile,
    providerRoute: ['openai'],
    contextWindowTokens: 1050000,
    maximumOutputTokens: 128000,
    inputCostPerMillionUsd: route.rateCard.inputCostPerMillionUsd,
    outputCostPerMillionUsd: route.rateCard.outputCostPerMillionUsd,
    outputSemantics: 'total_including_reasoning',
    reasoningCountsAgainstControl: true,
    verificationState: 'verified',
    verificationReason:
      'Explicit direct OpenAI Luna profile; native Responses count and combined output control supported.',
    nativeCounter: 'openai_responses_input_tokens',
    sources: [
      'https://developers.openai.com/api/docs/guides/token-counting',
      'https://vercel.com/ai-gateway/models/gpt-6-luna',
    ],
  };
}
