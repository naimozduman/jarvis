import { pathToFileURL } from 'node:url';

/**
 * Vercel documents this unauthenticated endpoint as the source of its current model metadata.
 * The current Free Tier model listing is represented in that metadata by the exact `free` tag.
 * Pricing is deliberately not part of this proof: Free Tier models retain provider list pricing
 * because requests consume the included monthly AI Gateway credits at those rates.
 */
export const catalogUrl = 'https://ai-gateway.vercel.sh/v1/models';
export const freeTierEligibilitySignal = Object.freeze({
  source: catalogUrl,
  field: 'data[].tags',
  requiredValue: 'free',
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactModelId(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

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

/**
 * Accept only the currently documented Models API envelope. Supporting guessed alternate fields
 * such as `models` would turn an upstream schema change into a potentially paid model request.
 */
export function catalogModels(payload) {
  if (!isRecord(payload) || payload.object !== 'list' || !Array.isArray(payload.data)) {
    return undefined;
  }
  return payload.data;
}

/**
 * Returns the provider's eligibility result for one model. This is intentionally stricter than
 * checking for a model-name suffix, provider, zero price, or an arbitrary marketing label.
 */
export function freeTierEligibilityForModel(model) {
  if (!isRecord(model) || !exactModelId(model.id)) {
    return { eligible: false, failure: 'model metadata is malformed' };
  }
  if (!Object.hasOwn(model, 'tags')) {
    return {
      eligible: false,
      failure: 'missing Vercel Free Tier eligibility field `tags`',
    };
  }
  if (!Array.isArray(model.tags) || !model.tags.every((tag) => typeof tag === 'string')) {
    return {
      eligible: false,
      failure: 'Vercel Free Tier eligibility field `tags` is malformed',
    };
  }
  if (!model.tags.includes(freeTierEligibilitySignal.requiredValue)) {
    return {
      eligible: false,
      failure: 'not currently marked Free Tier eligible by Vercel metadata',
    };
  }
  return { eligible: true };
}

/**
 * A report of only exact model IDs that public Vercel metadata currently proves Free Tier
 * eligible. Invalid or missing metadata never appears in this output.
 */
export function inspectFreeTierCatalog(payload) {
  const models = catalogModels(payload);
  if (!models) {
    return {
      catalogVerified: false,
      freeTierEligibleModelIds: [],
      failures: ['the public Vercel AI Gateway catalog has an unsupported schema'],
    };
  }

  const freeTierEligibleModelIds = [
    ...new Set(
      models.flatMap((model) => {
        const id = isRecord(model) ? exactModelId(model.id) : undefined;
        return id && freeTierEligibilityForModel(model).eligible ? [id] : [];
      }),
    ),
  ].sort((left, right) => left.localeCompare(right));
  return { catalogVerified: true, freeTierEligibleModelIds, failures: [] };
}

export function verifyConfiguredModels(configuredModels, payload) {
  const catalog = inspectFreeTierCatalog(payload);
  if (!catalog.catalogVerified) {
    return {
      ...catalog,
      verifiedModelIds: [],
    };
  }

  const uniqueConfiguredModels = [...new Set(configuredModels)];
  if (uniqueConfiguredModels.length === 0) {
    return {
      ...catalog,
      verifiedModelIds: [],
      failures: ['no Vercel AI Gateway model is configured'],
    };
  }

  const models = catalogModels(payload);
  // `catalog.catalogVerified` above proves this is the documented array shape.
  const failures = uniqueConfiguredModels.flatMap((configuredModel) => {
    const match = models.find(
      (candidate) => isRecord(candidate) && candidate.id === configuredModel,
    );
    if (!match) {
      return [`${configuredModel}: not present in the public catalog`];
    }
    const eligibility = freeTierEligibilityForModel(match);
    return eligibility.eligible ? [] : [`${configuredModel}: ${eligibility.failure}`];
  });
  return {
    ...catalog,
    verifiedModelIds: failures.length === 0 ? uniqueConfiguredModels : [],
    failures,
  };
}

export async function verifyFromPublicCatalog({
  environment = process.env,
  fetchImplementation = globalThis.fetch,
} = {}) {
  const configuredModels = configuredModelsFromEnvironment(environment);
  if (environment.JARVIS_ZERO_COST_MODE !== 'true') {
    return {
      skipped: true,
      catalogVerified: false,
      configuredModelIds: configuredModels,
      freeTierEligibleModelIds: [],
      verifiedModelIds: [],
      failures: [],
    };
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
      catalogVerified: false,
      configuredModelIds: configuredModels,
      freeTierEligibleModelIds: [],
      verifiedModelIds: [],
      failures: ['the public Vercel AI Gateway catalog could not be reached'],
    };
  }
  if (!response.ok) {
    return {
      skipped: false,
      catalogVerified: false,
      configuredModelIds: configuredModels,
      freeTierEligibleModelIds: [],
      verifiedModelIds: [],
      failures: [`the public Vercel AI Gateway catalog returned HTTP ${response.status}`],
    };
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return {
      skipped: false,
      catalogVerified: false,
      configuredModelIds: configuredModels,
      freeTierEligibleModelIds: [],
      verifiedModelIds: [],
      failures: ['the public Vercel AI Gateway catalog returned invalid JSON'],
    };
  }
  return {
    skipped: false,
    configuredModelIds: configuredModels,
    ...verifyConfiguredModels(configuredModels, payload),
  };
}

function auditReport(result) {
  return {
    schemaVersion: 1,
    catalogUrl,
    freeTierEligibilitySignal,
    catalogVerified: result.catalogVerified,
    configuredModelIds: result.configuredModelIds,
    freeTierEligibleModelIds: result.freeTierEligibleModelIds,
    verifiedConfiguredModelIds: result.verifiedModelIds,
    failures: result.failures,
  };
}

async function main() {
  const catalogOnly = process.argv.includes('--catalog-only');
  const result = await verifyFromPublicCatalog();
  if (result.skipped) {
    console.log(
      JSON.stringify({
        schemaVersion: 1,
        catalogUrl,
        freeTierEligibilitySignal,
        skipped: true,
        reason: 'JARVIS_ZERO_COST_MODE is not enabled.',
      }),
    );
    return;
  }

  // This is intentionally machine-readable so a deployment review can retain the exact provider
  // eligibility source, full verified public list, configured list, and failures together.
  console.log(JSON.stringify(auditReport(result)));
  if (!result.catalogVerified || (!catalogOnly && result.failures.length > 0)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
