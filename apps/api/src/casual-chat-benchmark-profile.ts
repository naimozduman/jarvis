import type { OpenAiModelRouteConfiguration } from '@jarvis/config';
import type { ModelAdmissionProfile } from '@jarvis/contracts';
import { profileFromGatewayCatalog } from '@jarvis/brain';

export const fastChatBenchmarkCandidates = {
  luna_low: { model: 'openai/gpt-6-luna', reasoningEffort: 'low' },
  luna_fast_low: { model: 'openai/gpt-6-luna-fast', reasoningEffort: 'low' },
  nano_none: { model: 'openai/gpt-5.4-nano', reasoningEffort: 'none' },
} as const;
export type FastChatBenchmarkCandidate = keyof typeof fastChatBenchmarkCandidates;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// Public model metadata includes regional and tier pricing omitted by some endpoints.
function modelRate(pricing: unknown, direction: 'input' | 'output'): number | null {
  if (!record(pricing)) return null;
  const rates: number[] = [];
  let valid = true;
  const visit = (value: unknown): void => {
    if (!record(value)) return;
    if (direction in value) {
      const rate = Number(value[direction]);
      if (!Number.isFinite(rate) || rate < 0) valid = false;
      else rates.push(rate * 1_000_000);
    }
    const tiers = value[`${direction}_tiers`];
    if (tiers !== undefined) {
      if (!Array.isArray(tiers)) valid = false;
      else
        for (const tier of tiers) {
          const rate = record(tier) ? Number(tier.cost) : NaN;
          if (!Number.isFinite(rate) || rate < 0) valid = false;
          else rates.push(rate * 1_000_000);
        }
    }
    for (const nested of Object.values(value)) if (record(nested)) visit(nested);
  };
  visit(pricing);
  return valid && rates.length > 0 ? Math.ceil(Math.max(...rates) * 1e9) / 1e9 : null;
}

/** Isolated evaluation profiles; this never widens the production admission allowlist. */
export function fastChatBenchmarkProfile(
  route: OpenAiModelRouteConfiguration,
  endpointsCatalog: unknown,
  modelCatalog: unknown,
): ModelAdmissionProfile {
  const profile = profileFromGatewayCatalog(route, endpointsCatalog);
  if (!['openai/gpt-6-luna-fast', 'openai/gpt-5.4-nano'].includes(route.model)) return profile;
  if (
    !record(endpointsCatalog) ||
    !record(endpointsCatalog.data) ||
    !Array.isArray(endpointsCatalog.data.endpoints) ||
    !record(modelCatalog) ||
    modelCatalog.id !== route.model
  )
    return profile;
  const endpoints = endpointsCatalog.data.endpoints;
  const reasoning = endpointsCatalog.data.reasoning;
  const inputRate = modelRate(modelCatalog.pricing, 'input');
  const outputRate = modelRate(modelCatalog.pricing, 'output');
  const valid =
    endpointsCatalog.data.id === route.model &&
    endpoints.length > 0 &&
    endpoints.every((endpoint) => {
      if (!record(endpoint)) return false;
      const parameters = endpoint.supported_parameters;
      const pricing = endpoint.pricing;
      return (
        ['openai', 'azure'].includes(String(endpoint.provider_name)) &&
        Array.isArray(parameters) &&
        ['response_format', 'structured_outputs'].every((p) => parameters.includes(p)) &&
        record(pricing) &&
        ['request', 'internal_reasoning'].every(
          (p) => pricing[p] !== undefined && Number(pricing[p]) === 0,
        )
      );
    }) &&
    record(reasoning) &&
    Array.isArray(reasoning.supported_efforts) &&
    reasoning.supported_efforts.includes(route.reasoningEffort) &&
    profile.contextWindowTokens !== null &&
    profile.maximumOutputTokens !== null &&
    profile.inputCostPerMillionUsd !== null &&
    profile.outputCostPerMillionUsd !== null &&
    inputRate !== null &&
    outputRate !== null;
  if (!valid) return profile;
  return {
    ...profile,
    version: 'synthetic-fast-chat-profile-v1-20261001',
    inputCostPerMillionUsd: Math.max(profile.inputCostPerMillionUsd!, inputRate!),
    outputCostPerMillionUsd: Math.max(profile.outputCostPerMillionUsd!, outputRate!),
    verificationState: 'verified',
    outputSemantics: 'total_including_reasoning',
    reasoningCountsAgainstControl: true,
    verificationReason:
      'Synthetic evaluation only: base OpenAI model supports the unchanged strict schema; live endpoint capabilities, reasoning, context and all model/regional/tier prices verified. Documented combined generation cap enforced against actual receipts.',
    sources: [
      ...profile.sources,
      'https://ai-gateway.vercel.sh/v1/models',
      `https://vercel.com/ai-gateway/models/${route.model.split('/')[1]}`,
      'https://developers.openai.com/api/docs/guides/structured-outputs',
    ],
  };
}

export async function loadFastChatBenchmarkProfile(
  route: OpenAiModelRouteConfiguration,
): Promise<ModelAdmissionProfile> {
  const [endpointsResponse, modelsResponse] = await Promise.all([
    fetch(`https://ai-gateway.vercel.sh/v1/models/${route.model}/endpoints`, {
      signal: AbortSignal.timeout(10000),
    }),
    fetch('https://ai-gateway.vercel.sh/v1/models', { signal: AbortSignal.timeout(10000) }),
  ]);
  if (!endpointsResponse.ok || !modelsResponse.ok) return profileFromGatewayCatalog(route, null);
  const catalog: unknown = await modelsResponse.json();
  const model =
    record(catalog) && Array.isArray(catalog.data)
      ? catalog.data.find((m: unknown) => record(m) && m.id === route.model)
      : null;
  return fastChatBenchmarkProfile(route, await endpointsResponse.json(), model);
}
