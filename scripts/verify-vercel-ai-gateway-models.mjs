import { pathToFileURL } from 'node:url';

export const catalogUrl = 'https://ai-gateway.vercel.sh/v1/models';

export function configuredModelsFromEnvironment(environment = process.env) {
  return [
    environment.JARVIS_VERCEL_AI_GATEWAY_FAST_MODEL,
    environment.JARVIS_VERCEL_AI_GATEWAY_STANDARD_MODEL,
    environment.JARVIS_VERCEL_AI_GATEWAY_DEEP_MODEL,
  ]
    .filter((model) => typeof model === 'string')
    .map((model) => model.trim())
    .filter((model) => model.length > 0);
}

export function catalogModels(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const record = payload;
    if (Array.isArray(record.data)) {
      return record.data;
    }
    if (Array.isArray(record.models)) {
      return record.models;
    }
  }
  return [];
}

export function hasZeroPrice(model) {
  const candidates = ['pricing', 'price', 'prices', 'cost']
    .filter((key) => Object.prototype.hasOwnProperty.call(model, key))
    .map((key) => model[key]);
  if (candidates.length === 0) return false;

  let valueCount = 0;
  const explicitlyZero = (value) => {
    if (typeof value === 'number') {
      valueCount += 1;
      return Number.isFinite(value) && value === 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0 && value.every(explicitlyZero);
    }
    if (value && typeof value === 'object') {
      const entries = Object.values(value);
      return entries.length > 0 && entries.every(explicitlyZero);
    }
    // A string price, `null`, or a missing nested rate is not evidence of a zero-cost route.
    return false;
  };
  return candidates.every(explicitlyZero) && valueCount > 0;
}

export function verifyConfiguredModels(configuredModels, payload) {
  const models = catalogModels(payload);
  if (configuredModels.length === 0) {
    return {
      verifiedModelIds: [],
      failures: ['no Vercel AI Gateway model is configured'],
    };
  }
  const failures = configuredModels.flatMap((configuredModel) => {
    const match = models.find(
      (candidate) => candidate && typeof candidate === 'object' && candidate.id === configuredModel,
    );
    if (!match) {
      return [`${configuredModel}: not present in the public catalog`];
    }
    const tags = Array.isArray(match.tags) ? match.tags : [];
    if (!tags.includes('free')) {
      return [`${configuredModel}: not currently tagged free`];
    }
    if (!hasZeroPrice(match)) {
      return [`${configuredModel}: catalog pricing is not verified as zero`];
    }
    return [];
  });
  return {
    verifiedModelIds: failures.length === 0 ? [...new Set(configuredModels)] : [],
    failures,
  };
}

export async function verifyFromPublicCatalog({
  environment = process.env,
  fetchImplementation = globalThis.fetch,
} = {}) {
  const configuredModels = configuredModelsFromEnvironment(environment);
  if (environment.JARVIS_ZERO_COST_MODE !== 'true') {
    return { skipped: true, verifiedModelIds: [], failures: [] };
  }
  let response;
  try {
    response = await fetchImplementation(catalogUrl, {
      headers: { accept: 'application/json' },
      signal: globalThis.AbortSignal.timeout(15_000),
    });
  } catch {
    return {
      skipped: false,
      verifiedModelIds: [],
      failures: ['the public Vercel AI Gateway catalog could not be reached'],
    };
  }
  if (!response.ok) {
    return {
      skipped: false,
      verifiedModelIds: [],
      failures: [`the public Vercel AI Gateway catalog returned HTTP ${response.status}`],
    };
  }
  return { skipped: false, ...verifyConfiguredModels(configuredModels, await response.json()) };
}

async function main() {
  const result = await verifyFromPublicCatalog();
  if (result.skipped) {
    console.log(
      'Zero-cost model verification skipped because JARVIS_ZERO_COST_MODE is not enabled.',
    );
    return;
  }
  if (result.failures.length > 0) {
    console.error(`Zero-cost AI Gateway verification failed: ${result.failures.join('; ')}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Verified ${result.verifiedModelIds.length} configured Vercel AI Gateway free model(s).`,
  );
  console.log(`JARVIS_ZERO_COST_VERIFIED_MODEL_IDS=${result.verifiedModelIds.join(',')}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
