import { z } from 'zod';

const applicationEnvironments = ['development', 'test', 'staging', 'production'] as const;
const booleanEnvironmentSchema = z.enum(['true', 'false']);
const personalOriginSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      ['', '/'].includes(url.pathname)
    );
  });
const personalTokenSchema = z.string().min(32).max(1024).regex(/^\S+$/);
const modelProviderSchema = z.enum(['openai-responses', 'vercel-ai-gateway']);

/**
 * A deliberately non-provider model identifier used when a Vercel route has not been selected.
 * It is never considered a free model and the Gateway adapter refuses to issue a request for it.
 */
export const unconfiguredGatewayModelId = 'not_configured' as const;

/**
 * This is the only non-release Evolution source revision that passed the Phase 3 Baileys gate at
 * implementation time. It is intentionally limited to explicitly approved non-production
 * validation; a new stable release needs a separate review and code/doc update.
 */
export const reviewedEvolutionSourceBuildId = 'e273b904d53f5726970fd6a244ed9caa61dfeb9a' as const;
export const reviewedEvolutionBaileysVersion = '7.0.0-rc13' as const;

export const applicationEnvironmentSchema = z.enum(applicationEnvironments);
export type ApplicationEnvironment = z.infer<typeof applicationEnvironmentSchema>;

const rawEnvironmentSchema = z.object({
  APP_ENV: applicationEnvironmentSchema.default('development'),
  APP_URL: z.string().url().optional(),
  API_URL: z.string().url().optional(),
  JARVIS_PERSONAL_SYSTEM_READ_TOKEN: personalTokenSchema.optional(),
  JARVIS_PERSONAL_SYSTEM_READ_TOKEN_NEXT: personalTokenSchema.optional(),
  GROWTH_API_URL: personalOriginSchema.optional(),
  GROWTH_API_TOKEN: personalTokenSchema.optional(),
  OURHOURS_API_URL: personalOriginSchema.optional(),
  OURHOURS_API_TOKEN: personalTokenSchema.optional(),
  IRON_API_URL: personalOriginSchema.optional(),
  IRON_API_TOKEN: personalTokenSchema.optional(),
  USER_TIMEZONE: z.string().trim().min(1).optional(),
  ALLOWED_USER_EMAIL: z.string().email().optional(),
  DATABASE_URL: z.string().url().optional(),
  JARVIS_TEST_DATABASE_URL: z.string().url().optional(),
  ENCRYPTION_KEY_CURRENT: z.string().min(32).optional(),
  ENCRYPTION_KEY_VERSION: z.coerce.number().int().positive().default(1),
  INTERNAL_SERVICE_TOKEN_PEPPER: z.string().min(32).optional(),
  /** Railway assigns PORT at runtime; API_PORT/WORKER_HEALTH_PORT remain useful locally. */
  PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(4100),
  /**
   * Optional, staging-only bearer token for the narrow synthetic runtime probe route. It is not a
   * user session, never has a development default, and is deliberately ignored outside staging.
   */
  STAGING_RUNTIME_TEST_TOKEN: z.string().trim().min(32).max(1_024).optional(),
  /** Temporary credential for the exact Phase 3.6D.1 existing-job recovery operation. */
  STAGING_PHASE_3_6D1_RECOVERY_TOKEN: z.string().trim().min(32).max(1_024).optional(),
  PROVIDER_INTEGRATIONS_ENABLED: booleanEnvironmentSchema.default('false'),
  JARVIS_EVOLUTION_ENABLED: booleanEnvironmentSchema.default('false'),
  JARVIS_OWNER_ID: z.uuid().optional(),
  /** Enables only the private normalized-event intake from the official WhatsApp Cloud bridge. */
  JARVIS_WHATSAPP_CLOUD_INGEST_ENABLED: booleanEnvironmentSchema.default('false'),
  /** Server-only bearer credential shared with the dedicated WhatsApp bridge deployment. */
  JARVIS_INGEST_TOKEN: z.string().trim().min(32).max(1_024).optional(),
  /** Bridge instance scope, not a WhatsApp account, phone number, or Meta identifier. */
  JARVIS_WHATSAPP_CLOUD_INGEST_INSTANCE_ID: z.string().trim().min(1).max(160).optional(),
  /** Enables only verified-owner direct conversation handling through the canonical Brain. */
  JARVIS_WHATSAPP_CLOUD_OWNER_DM_ENABLED: booleanEnvironmentSchema.default('false'),
  /** Server-only base URL of the separately deployed official Cloud bridge. */
  JARVIS_WHATSAPP_CLOUD_DELIVERY_BRIDGE_URL: z.string().url().optional(),
  /** Separate from ingress and orchestration credentials; never expose to a browser. */
  JARVIS_WHATSAPP_CLOUD_DELIVERY_TOKEN: z.string().trim().min(32).max(1_024).optional(),
  /** Stable bridge process identity used only as a canonical delivery-lease owner. */
  JARVIS_WHATSAPP_CLOUD_DELIVERY_BRIDGE_ID: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9._:-]{7,159}$/)
    .optional(),
  /** Official Telegram Bot API surface. Inbound enrollment is allowed before owner replies. */
  JARVIS_TELEGRAM_BOT_TOKEN: z.string().trim().min(32).max(1_024).optional(),
  JARVIS_TELEGRAM_WEBHOOK_SECRET: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,256}$/)
    .optional(),
  /** Separate operator boundary for Telegram registration and exact participant enrollment. */
  JARVIS_TELEGRAM_OPERATOR_TOKEN: z.string().trim().min(48).max(1_024).optional(),
  JARVIS_TELEGRAM_BOT_ENABLED: booleanEnvironmentSchema.default('false'),
  JARVIS_TELEGRAM_OWNER_DM_ENABLED: booleanEnvironmentSchema.default('false'),
  JARVIS_WHATSAPP_INSTANCE: z.string().trim().min(1).max(160).optional(),
  JARVIS_OWNER_PHONE: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9(). -]{5,30}$/)
    .optional(),
  /** Optional pre-enrolled LID; provider-supplied alternate JIDs never authorize it. */
  JARVIS_OWNER_WHATSAPP_LID: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._:-]{1,256}@lid$/)
    .optional(),
  EVOLUTION_BASE_URL: z
    .string()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === 'http:' || protocol === 'https:';
    })
    .optional(),
  /** Never log this credential. It is intentionally absent in provider-free CI. */
  EVOLUTION_API_KEY: z.string().trim().min(16).max(1_024).optional(),
  /** HS256 signing secret for Evolution's per-instance webhook JWT, never an API key. */
  EVOLUTION_WEBHOOK_SECRET: z.string().trim().min(32).max(1_024).optional(),
  EVOLUTION_PROVIDER_BUILD_ID: z.string().trim().min(12).max(256).optional(),
  EVOLUTION_BAILEYS_VERSION: z.string().trim().min(1).max(80).optional(),
  EVOLUTION_IMAGE_DIGEST: z
    .string()
    .trim()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .optional(),
  EVOLUTION_ALLOW_UNSTABLE_SOURCE_BUILD: booleanEnvironmentSchema.default('false'),
  EVOLUTION_WEBHOOK_MAX_BODY_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(1_048_576)
    .default(65_536),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  /**
   * Direct OpenAI remains a deliberately configured adapter. Zero-cost deployments select the
   * Vercel AI Gateway adapter instead and never use this credential as a fallback.
   */
  JARVIS_MODEL_PROVIDER: modelProviderSchema.default('openai-responses'),
  JARVIS_ZERO_COST_MODE: booleanEnvironmentSchema.default('false'),
  /**
   * The conservative JARVIS-side ceiling for Vercel's current $5 monthly Free Tier allowance.
   * The schema caps this at $4 so configuration retains at least a 20% reserve; the documented
   * default is $3 to leave a larger reconciliation and provider-accounting margin.
   */
  JARVIS_ZERO_COST_MONTHLY_CREDIT_GUARD_USD: z.coerce.number().min(0).max(4).default(3),
  /**
   * A server-only, operator-observed Vercel Free Tier usage snapshot. Its absence does not make
   * configuration invalid, but it makes a zero-cost model request fail closed at runtime.
   */
  JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_USD: z.coerce.number().min(0).optional(),
  JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_AS_OF: z.string().datetime({ offset: true }).optional(),
  /** Vercel injects this OIDC token for deployed server-side functions; never log it. */
  VERCEL_OIDC_TOKEN: z.string().trim().min(1).optional(),
  /**
   * This project never consumes a Gateway API key. In zero-cost mode its presence is rejected so
   * a manual paid-key route cannot silently become a fallback.
   */
  AI_GATEWAY_API_KEY: z.string().trim().min(1).optional(),
  /**
   * Comma-separated exact IDs emitted by the deployment-time public Gateway catalog verifier.
   * A model name itself is not evidence of price. An absent list leaves the runtime explicitly
   * not configured rather than allowing a potentially billable request.
   */
  JARVIS_ZERO_COST_VERIFIED_MODEL_IDS: z.string().trim().min(1).max(2_048).optional(),
  JARVIS_VERCEL_AI_GATEWAY_FAST_MODEL: z.string().trim().min(1).max(160).optional(),
  JARVIS_VERCEL_AI_GATEWAY_STANDARD_MODEL: z.string().trim().min(1).max(160).optional(),
  JARVIS_VERCEL_AI_GATEWAY_DEEP_MODEL: z.string().trim().min(1).max(160).optional(),
  /**
   * These are a conservative catalog-price rate card for the application-side credit guard, not
   * eligibility evidence. A configured zero-cost route with an incomplete rate card fails closed.
   */
  JARVIS_VERCEL_AI_GATEWAY_FAST_INPUT_COST_PER_MILLION: z.coerce.number().min(0).optional(),
  JARVIS_VERCEL_AI_GATEWAY_FAST_OUTPUT_COST_PER_MILLION: z.coerce.number().min(0).optional(),
  JARVIS_VERCEL_AI_GATEWAY_STANDARD_INPUT_COST_PER_MILLION: z.coerce.number().min(0).optional(),
  JARVIS_VERCEL_AI_GATEWAY_STANDARD_OUTPUT_COST_PER_MILLION: z.coerce.number().min(0).optional(),
  JARVIS_VERCEL_AI_GATEWAY_DEEP_INPUT_COST_PER_MILLION: z.coerce.number().min(0).optional(),
  JARVIS_VERCEL_AI_GATEWAY_DEEP_OUTPUT_COST_PER_MILLION: z.coerce.number().min(0).optional(),
  /** Opaque orchestration endpoint, not a canonical-state store. */
  JARVIS_CONVEX_ORCHESTRATION_URL: z.string().url().optional(),
  /** Vercel -> Convex command authentication. Never exposed to browser code. */
  JARVIS_VERCEL_TO_CONVEX_SECRET: z.string().trim().min(32).max(1_024).optional(),
  /** Convex -> Vercel callback authentication. Never exposed to browser code. */
  JARVIS_CONVEX_TO_VERCEL_SECRET: z.string().trim().min(32).max(1_024).optional(),
  /** Local bridge subscription credential; only the local process and Convex receive it. */
  JARVIS_LOCAL_BRIDGE_TOKEN: z.string().trim().min(32).max(1_024).optional(),
  /** Enables the Vercel-facing API boundary only; it never starts or configures Evolution. */
  JARVIS_LOCAL_BRIDGE_ENABLED: booleanEnvironmentSchema.default('false'),
  /** Trusted canonical scope used by the local bridge; never supplied by a request body. */
  JARVIS_LOCAL_BRIDGE_OWNER_ID: z.uuid().optional(),
  /** Trusted canonical connection scope used by bridge heartbeats. */
  JARVIS_LOCAL_BRIDGE_CONNECTION_ID: z.uuid().optional(),
  /** Opaque owner-target digest produced locally; Vercel never needs the raw telephone number. */
  JARVIS_LOCAL_BRIDGE_OWNER_TARGET_REFERENCE: z
    .string()
    .trim()
    .regex(/^evo:owner-target:[a-f0-9]{64}$/)
    .optional(),
  JARVIS_OPENAI_FAST_MODEL: z.string().trim().min(1).max(160).default('gpt-5.6-luna'),
  JARVIS_OPENAI_STANDARD_MODEL: z.string().trim().min(1).max(160).default('gpt-5.6-terra'),
  JARVIS_OPENAI_DEEP_MODEL: z.string().trim().min(1).max(160).default('gpt-5.6-sol'),
  JARVIS_OPENAI_FAST_REASONING_EFFORT: z
    .enum(['none', 'low', 'medium', 'high', 'xhigh', 'max'])
    .default('low'),
  JARVIS_OPENAI_STANDARD_REASONING_EFFORT: z
    .enum(['none', 'low', 'medium', 'high', 'xhigh', 'max'])
    .default('medium'),
  JARVIS_OPENAI_DEEP_REASONING_EFFORT: z
    .enum(['none', 'low', 'medium', 'high', 'xhigh', 'max'])
    .default('high'),
  JARVIS_OPENAI_FAST_VERBOSITY: z.enum(['low', 'medium', 'high']).default('low'),
  JARVIS_OPENAI_STANDARD_VERBOSITY: z.enum(['low', 'medium', 'high']).default('low'),
  JARVIS_OPENAI_DEEP_VERBOSITY: z.enum(['low', 'medium', 'high']).default('medium'),
  JARVIS_OPENAI_FAST_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(128)
    .max(128_000)
    .default(1_500),
  JARVIS_OPENAI_STANDARD_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(128)
    .max(128_000)
    .default(2_500),
  JARVIS_OPENAI_DEEP_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(128)
    .max(128_000)
    .default(4_000),
  JARVIS_OPENAI_FAST_INPUT_COST_PER_MILLION: z.coerce.number().min(0).default(0.2),
  JARVIS_OPENAI_FAST_CACHED_INPUT_COST_PER_MILLION: z.coerce.number().min(0).default(0.02),
  JARVIS_OPENAI_FAST_OUTPUT_COST_PER_MILLION: z.coerce.number().min(0).default(1.2),
  JARVIS_OPENAI_STANDARD_INPUT_COST_PER_MILLION: z.coerce.number().min(0).default(2),
  JARVIS_OPENAI_STANDARD_CACHED_INPUT_COST_PER_MILLION: z.coerce.number().min(0).default(0.2),
  JARVIS_OPENAI_STANDARD_OUTPUT_COST_PER_MILLION: z.coerce.number().min(0).default(12),
  JARVIS_OPENAI_DEEP_INPUT_COST_PER_MILLION: z.coerce.number().min(0).default(4),
  JARVIS_OPENAI_DEEP_CACHED_INPUT_COST_PER_MILLION: z.coerce.number().min(0).default(0.4),
  JARVIS_OPENAI_DEEP_OUTPUT_COST_PER_MILLION: z.coerce.number().min(0).default(20),
  JARVIS_BRAIN_MAX_CONTEXT_RECORDS: z.coerce.number().int().min(1).max(200).default(32),
  JARVIS_BRAIN_MAX_RECENT_MESSAGES: z.coerce.number().int().min(0).max(100).default(12),
  JARVIS_BRAIN_MAX_APPROX_PROMPT_TOKENS: z.coerce
    .number()
    .int()
    .min(256)
    .max(100_000)
    .default(6_000),
  JARVIS_BRAIN_MAX_MODEL_CALLS_PER_CYCLE: z.coerce.number().int().min(0).max(5).default(1),
  JARVIS_BRAIN_DAILY_MODEL_SPEND_LIMIT_USD: z.coerce.number().min(0).default(10),
  JARVIS_BRAIN_DAILY_DEEP_CALL_LIMIT: z.coerce.number().int().min(0).max(100).default(8),
  JARVIS_BRAIN_DEEP_ESCALATION_ENABLED: z.enum(['true', 'false']).default('false'),
  JARVIS_BRAIN_DAILY_PROACTIVE_MESSAGE_MIN: z.coerce.number().int().min(0).max(50).default(6),
  JARVIS_BRAIN_DAILY_PROACTIVE_MESSAGE_MAX: z.coerce.number().int().min(0).max(50).default(9),
});

type ParsedEnvironment = z.infer<typeof rawEnvironmentSchema>;

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export interface PersonalAppEnvironment {
  readonly baseUrl: string;
  /** Server only. Never return this configuration from an API. */
  readonly token: string;
}
export interface PersonalSystemEnvironment {
  readonly ourhours?: PersonalAppEnvironment;
  readonly growth?: PersonalAppEnvironment;
  readonly iron?: PersonalAppEnvironment;
}

export interface RuntimeEnvironment {
  readonly personalSystemRead: {
    readonly token: string | undefined;
    readonly nextToken: string | undefined;
  };
  readonly personalApps: PersonalSystemEnvironment;
  readonly appEnvironment: ApplicationEnvironment;
  readonly appUrl: string;
  readonly apiUrl: string;
  readonly userTimezone: string;
  readonly allowedUserEmail: string | undefined;
  readonly databaseUrl: string | undefined;
  readonly testDatabaseUrl: string | undefined;
  readonly encryptionKeyCurrent: string | undefined;
  readonly encryptionKeyVersion: number;
  readonly internalServiceTokenPepper: string | undefined;
  readonly apiPort: number;
  readonly workerHealthPort: number;
  readonly stagingRuntimeTestToken: string | undefined;
  readonly stagingPhase3d1RecoveryToken: string | undefined;
  readonly providerIntegrationsEnabled: boolean;
  /** Canonical owner configuration is shared by narrow server-side connectors. */
  readonly ownerId: string | undefined;
  readonly evolution: EvolutionRuntimeConfiguration;
  readonly whatsappCloudIngest: WhatsAppCloudIngestRuntimeConfiguration;
  readonly telegramBot: TelegramBotRuntimeConfiguration;
  readonly model: ModelRuntimeConfiguration;
  readonly orchestration: OrchestrationRuntimeConfiguration;
  readonly openAi: OpenAiRuntimeConfiguration;
  readonly brain: BrainRuntimeConfiguration;
}

export type ModelReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type ModelVerbosity = 'low' | 'medium' | 'high';

export interface ModelRateCard {
  /** `null` means JARVIS has no verified rate bound and must not make a zero-cost request. */
  readonly inputCostPerMillionUsd: number | null;
  /** Kept for direct OpenAI estimates; zero-cost guarding uses the full input rate conservatively. */
  readonly cachedInputCostPerMillionUsd: number | null;
  readonly outputCostPerMillionUsd: number | null;
}

export interface OpenAiModelRouteConfiguration {
  readonly model: string;
  readonly reasoningEffort: ModelReasoningEffort;
  readonly reasoningMode: 'standard';
  readonly reasoningContext: 'current_turn';
  readonly verbosity: ModelVerbosity;
  readonly maxOutputTokens: number;
  readonly rateCard: ModelRateCard;
}

export interface OpenAiRuntimeConfiguration {
  /** Never log this field; its optionality preserves provider-free development and CI. */
  readonly apiKey: string | undefined;
  readonly fast: OpenAiModelRouteConfiguration;
  readonly standard: OpenAiModelRouteConfiguration;
  readonly deep: OpenAiModelRouteConfiguration;
}

/**
 * A conservative, server-only Free Tier accounting boundary. The Vercel dashboard snapshot is a
 * starting amount for the current monthly period; completed JARVIS calls are added only when the
 * Gateway reports an exact cost. Missing, stale-period, or incomplete accounting blocks calls.
 */
export interface ZeroCostFreeTierCreditGuardConfiguration {
  readonly monthlyCreditGuardUsd: number;
  readonly reportedMonthlyUsageUsd: number | undefined;
  readonly reportedMonthlyUsageAsOf: string | undefined;
}

/**
 * Provider-neutral model route configuration. The Vercel AI Gateway adapter intentionally uses
 * the same stateless Responses contract as the direct OpenAI adapter, while its credentials and
 * cost policy remain separate.
 */
export interface ModelRuntimeConfiguration {
  readonly provider: z.infer<typeof modelProviderSchema>;
  readonly zeroCostMode: boolean;
  /** Direct OpenAI credential only. It is undefined for the gateway adapter. */
  readonly apiKey: string | undefined;
  /** Vercel deployment OIDC token only. It is never required by provider-free CI. */
  readonly oidcToken: string | undefined;
  /** Exact model IDs proven free by the deployment-time catalog verifier, never inferred by name. */
  readonly verifiedFreeModelIds: readonly string[];
  readonly freeTierCreditGuard: ZeroCostFreeTierCreditGuardConfiguration;
  readonly fast: OpenAiModelRouteConfiguration;
  readonly standard: OpenAiModelRouteConfiguration;
  readonly deep: OpenAiModelRouteConfiguration;
}

export interface OrchestrationRuntimeConfiguration {
  readonly convexUrl: string | undefined;
  readonly vercelToConvexSecret: string | undefined;
  readonly convexToVercelSecret: string | undefined;
  readonly localBridgeToken: string | undefined;
  readonly localBridgeEnabled: boolean;
  readonly localBridgeOwnerId: string | undefined;
  readonly localBridgeConnectionId: string | undefined;
  readonly localBridgeOwnerTargetReference: string | undefined;
}

export interface WhatsAppCloudIngestRuntimeConfiguration {
  /** False by default. This route never enables Groups or third-party Agent APIs. */
  readonly enabled: boolean;
  /** Server-only bridge-to-JARVIS credential. */
  readonly accessToken: string | undefined;
  /** Expected bridge instance, used to prevent a different bridge from selecting this owner. */
  readonly expectedInstanceId: string | undefined;
  /** Explicit gate for the verified-owner direct-message conversation surface. */
  readonly ownerDirectMessagingEnabled: boolean;
  /** Separate official-Cloud bridge delivery endpoint, never a provider endpoint. */
  readonly deliveryBridgeUrl: string | undefined;
  /** Separate server-only delivery credential shared only with that bridge. */
  readonly deliveryToken: string | undefined;
  /** Opaque bridge identity used to bind canonical leases. */
  readonly deliveryBridgeId: string | undefined;
}

export interface TelegramBotRuntimeConfiguration {
  readonly token: string | undefined;
  readonly webhookSecret: string | undefined;
  /** Server-only credential for the narrowly-scoped Telegram operator routes. */
  readonly operatorToken: string | undefined;
  /** Enables Bot API adapter operations; owner Brain replies remain separately gated. */
  readonly enabled: boolean;
  readonly ownerDirectMessagingEnabled: boolean;
}

export interface BrainRuntimeConfiguration {
  readonly maxContextRecords: number;
  readonly maxRecentMessages: number;
  readonly maxApproxPromptTokens: number;
  readonly maxModelCallsPerCycle: number;
  readonly dailyModelSpendLimitUsd: number;
  readonly dailyDeepCallLimit: number;
  readonly deepEscalationEnabled: boolean;
  readonly dailyProactiveMessageMinimum: number;
  readonly dailyProactiveMessageMaximum: number;
}

export interface EvolutionRuntimeConfiguration {
  /** False by default; no app startup path calls Evolution while disabled. */
  readonly enabled: boolean;
  readonly ownerId: string | undefined;
  readonly whatsappInstance: string | undefined;
  readonly ownerPhone: string | undefined;
  /** Optional authenticated-admin-enrolled LID; never infer it from a webhook payload. */
  readonly ownerWhatsAppLid: string | undefined;
  readonly baseUrl: string | undefined;
  /** Never log or expose this field. */
  readonly apiKey: string | undefined;
  /** Never log or expose this field. */
  readonly webhookSecret: string | undefined;
  readonly providerBuildId: string | undefined;
  readonly baileysVersion: string | undefined;
  readonly imageDigest: string | undefined;
  readonly webhookMaxBodyBytes: number;
  /** Only a deliberately approved development/test source build can be enabled at this phase. */
  readonly unstableSourceBuildAllowed: boolean;
}

export interface WebEnvironment {
  readonly appEnvironment: ApplicationEnvironment;
  readonly appUrl: string;
  readonly apiUrl: string;
  readonly userTimezone: string;
  readonly providerIntegrationsEnabled: boolean;
}

export class EnvironmentValidationError extends Error {
  public readonly fields: readonly string[];

  public constructor(fields: readonly string[]) {
    const uniqueFields = [...new Set(fields)].sort();
    super(`Invalid environment configuration: ${uniqueFields.join(', ')}`);
    this.name = 'EnvironmentValidationError';
    this.fields = uniqueFields;
  }
}

const productionRequiredKeys = [
  'APP_URL',
  'API_URL',
  'ALLOWED_USER_EMAIL',
  'DATABASE_URL',
  'ENCRYPTION_KEY_CURRENT',
] as const;

/**
 * Staging is a server environment, not a development alias. The API and worker must have a
 * canonical Postgres connection at boot; the remaining production-only identity and encryption
 * rollout requirements stay deliberately separate until their production controls are enabled.
 */
const stagingRequiredKeys = ['DATABASE_URL'] as const;

const defaultAppUrl = 'http://localhost:3000';
const defaultApiUrl = 'http://localhost:4000';
const defaultUserTimezone = 'UTC';

function isPresent(source: EnvironmentSource, key: string): boolean {
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0;
}

function validationFields(error: z.ZodError): string[] {
  return error.issues.flatMap((issue) => {
    const [field] = issue.path;
    return typeof field === 'string' ? [field] : [];
  });
}

function parseRuntimeEnvironment(source: EnvironmentSource): RuntimeEnvironment {
  const parsed = rawEnvironmentSchema.safeParse(source);
  const requiredKeys =
    source.APP_ENV === 'production'
      ? productionRequiredKeys
      : source.APP_ENV === 'staging'
        ? stagingRequiredKeys
        : [];
  const missingRequiredFields = requiredKeys.filter((key) => !isPresent(source, key));
  const invalidFields = parsed.success ? [] : validationFields(parsed.error);
  const fields = [...missingRequiredFields, ...invalidFields];

  if (fields.length > 0) {
    throw new EnvironmentValidationError(fields);
  }

  if (!parsed.success) {
    throw new EnvironmentValidationError(['APP_ENV']);
  }

  if (
    parsed.data.JARVIS_PERSONAL_SYSTEM_READ_TOKEN_NEXT &&
    !parsed.data.JARVIS_PERSONAL_SYSTEM_READ_TOKEN
  )
    throw new EnvironmentValidationError(['JARVIS_PERSONAL_SYSTEM_READ_TOKEN']);
  if (parsed.data.JARVIS_PERSONAL_SYSTEM_READ_TOKEN && !parsed.data.JARVIS_OWNER_ID)
    throw new EnvironmentValidationError(['JARVIS_OWNER_ID']);
  for (const prefix of ['GROWTH', 'OURHOURS', 'IRON'] as const) {
    if (Boolean(parsed.data[`${prefix}_API_URL`]) !== Boolean(parsed.data[`${prefix}_API_TOKEN`])) {
      throw new EnvironmentValidationError([`${prefix}_API_URL`, `${prefix}_API_TOKEN`]);
    }
  }
  validateEvolutionConfiguration(parsed.data);
  validateModelConfiguration(parsed.data);
  validateLocalBridgeConfiguration(parsed.data);
  validateWhatsAppCloudIngestConfiguration(parsed.data);
  validateWhatsAppCloudOwnerConversationConfiguration(parsed.data);
  validateTelegramConfiguration(parsed.data);

  return toRuntimeEnvironment(parsed.data);
}

function validateModelConfiguration(parsed: ParsedEnvironment): void {
  if (parsed.JARVIS_ZERO_COST_MODE !== 'true') {
    return;
  }

  const invalid: string[] = [];
  if (parsed.JARVIS_MODEL_PROVIDER !== 'vercel-ai-gateway') {
    invalid.push('JARVIS_MODEL_PROVIDER');
  }
  if (parsed.OPENAI_API_KEY) {
    invalid.push('OPENAI_API_KEY');
  }
  if (parsed.AI_GATEWAY_API_KEY) {
    invalid.push('AI_GATEWAY_API_KEY');
  }
  const snapshotFields = [
    [
      'JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_USD',
      parsed.JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_USD,
    ],
    [
      'JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_AS_OF',
      parsed.JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_AS_OF,
    ],
  ] as const;
  if (
    snapshotFields.some(([, value]) => value === undefined) &&
    snapshotFields.some(([, value]) => value !== undefined)
  ) {
    invalid.push(...snapshotFields.map(([field]) => field));
  }
  const gatewayRateFields = [
    [
      'JARVIS_VERCEL_AI_GATEWAY_FAST_INPUT_COST_PER_MILLION',
      parsed.JARVIS_VERCEL_AI_GATEWAY_FAST_INPUT_COST_PER_MILLION,
    ],
    [
      'JARVIS_VERCEL_AI_GATEWAY_FAST_OUTPUT_COST_PER_MILLION',
      parsed.JARVIS_VERCEL_AI_GATEWAY_FAST_OUTPUT_COST_PER_MILLION,
    ],
    [
      'JARVIS_VERCEL_AI_GATEWAY_STANDARD_INPUT_COST_PER_MILLION',
      parsed.JARVIS_VERCEL_AI_GATEWAY_STANDARD_INPUT_COST_PER_MILLION,
    ],
    [
      'JARVIS_VERCEL_AI_GATEWAY_STANDARD_OUTPUT_COST_PER_MILLION',
      parsed.JARVIS_VERCEL_AI_GATEWAY_STANDARD_OUTPUT_COST_PER_MILLION,
    ],
    [
      'JARVIS_VERCEL_AI_GATEWAY_DEEP_INPUT_COST_PER_MILLION',
      parsed.JARVIS_VERCEL_AI_GATEWAY_DEEP_INPUT_COST_PER_MILLION,
    ],
    [
      'JARVIS_VERCEL_AI_GATEWAY_DEEP_OUTPUT_COST_PER_MILLION',
      parsed.JARVIS_VERCEL_AI_GATEWAY_DEEP_OUTPUT_COST_PER_MILLION,
    ],
  ] as const;
  for (let index = 0; index < gatewayRateFields.length; index += 2) {
    const routeFields = gatewayRateFields.slice(index, index + 2);
    if (
      routeFields.some(([, value]) => value === undefined) &&
      routeFields.some(([, value]) => value !== undefined)
    ) {
      invalid.push(...routeFields.map(([field]) => field));
    }
  }
  if (invalid.length > 0) {
    throw new EnvironmentValidationError([...new Set(invalid)]);
  }
}

function verifiedModelIds(value: string | undefined): readonly string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(',')
        .map((model) => model.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Answers only whether the trusted deployment verifier allowed this exact configured route. It
 * intentionally does not inspect model names: suffixes, provider names, and rate cards are not
 * proof that a provider still offers a no-charge route.
 */
export function isVerifiedZeroCostGatewayRoute(
  configuration: ModelRuntimeConfiguration,
  route: keyof Pick<ModelRuntimeConfiguration, 'fast' | 'standard' | 'deep'>,
): boolean {
  const model = configuration[route].model;
  return (
    configuration.provider === 'vercel-ai-gateway' &&
    configuration.zeroCostMode &&
    model !== unconfiguredGatewayModelId &&
    configuration.verifiedFreeModelIds.includes(model)
  );
}

function validateEvolutionConfiguration(parsed: ParsedEnvironment): void {
  const enabled = parsed.JARVIS_EVOLUTION_ENABLED === 'true';
  if (!enabled) {
    return;
  }

  const missing = [
    ['PROVIDER_INTEGRATIONS_ENABLED', parsed.PROVIDER_INTEGRATIONS_ENABLED === 'true'],
    ['JARVIS_OWNER_ID', Boolean(parsed.JARVIS_OWNER_ID)],
    ['JARVIS_WHATSAPP_INSTANCE', Boolean(parsed.JARVIS_WHATSAPP_INSTANCE)],
    ['JARVIS_OWNER_PHONE', Boolean(parsed.JARVIS_OWNER_PHONE)],
    ['EVOLUTION_BASE_URL', Boolean(parsed.EVOLUTION_BASE_URL)],
    ['EVOLUTION_API_KEY', Boolean(parsed.EVOLUTION_API_KEY)],
    ['EVOLUTION_WEBHOOK_SECRET', Boolean(parsed.EVOLUTION_WEBHOOK_SECRET)],
    ['EVOLUTION_PROVIDER_BUILD_ID', Boolean(parsed.EVOLUTION_PROVIDER_BUILD_ID)],
    ['EVOLUTION_BAILEYS_VERSION', Boolean(parsed.EVOLUTION_BAILEYS_VERSION)],
    ['EVOLUTION_IMAGE_DIGEST', Boolean(parsed.EVOLUTION_IMAGE_DIGEST)],
  ]
    .filter(([, present]) => !present)
    .map(([field]) => field as string);

  if (missing.length > 0) {
    throw new EnvironmentValidationError(missing);
  }

  // Phase 3 intentionally supports only the audited development-source contingency. A stable
  // production Evolution release must be independently reviewed and added explicitly rather than
  // being accepted as an arbitrary string in environment configuration.
  const invalidGateFields: string[] = [];
  if (parsed.EVOLUTION_ALLOW_UNSTABLE_SOURCE_BUILD !== 'true') {
    invalidGateFields.push('EVOLUTION_ALLOW_UNSTABLE_SOURCE_BUILD');
  }
  if (parsed.EVOLUTION_PROVIDER_BUILD_ID !== reviewedEvolutionSourceBuildId) {
    invalidGateFields.push('EVOLUTION_PROVIDER_BUILD_ID');
  }
  if (parsed.EVOLUTION_BAILEYS_VERSION !== reviewedEvolutionBaileysVersion) {
    invalidGateFields.push('EVOLUTION_BAILEYS_VERSION');
  }
  if (parsed.APP_ENV === 'production') {
    invalidGateFields.push('JARVIS_EVOLUTION_ENABLED');
  }
  if (invalidGateFields.length > 0) {
    throw new EnvironmentValidationError(invalidGateFields);
  }
}

function validateLocalBridgeConfiguration(parsed: ParsedEnvironment): void {
  if (parsed.JARVIS_LOCAL_BRIDGE_ENABLED !== 'true') return;
  const invalid = [
    ['PROVIDER_INTEGRATIONS_ENABLED', parsed.PROVIDER_INTEGRATIONS_ENABLED === 'true'],
    ['JARVIS_LOCAL_BRIDGE_TOKEN', Boolean(parsed.JARVIS_LOCAL_BRIDGE_TOKEN)],
    ['JARVIS_LOCAL_BRIDGE_OWNER_ID', Boolean(parsed.JARVIS_LOCAL_BRIDGE_OWNER_ID)],
    ['JARVIS_LOCAL_BRIDGE_CONNECTION_ID', Boolean(parsed.JARVIS_LOCAL_BRIDGE_CONNECTION_ID)],
    [
      'JARVIS_LOCAL_BRIDGE_OWNER_TARGET_REFERENCE',
      Boolean(parsed.JARVIS_LOCAL_BRIDGE_OWNER_TARGET_REFERENCE),
    ],
    ['JARVIS_CONVEX_ORCHESTRATION_URL', Boolean(parsed.JARVIS_CONVEX_ORCHESTRATION_URL)],
    ['JARVIS_VERCEL_TO_CONVEX_SECRET', Boolean(parsed.JARVIS_VERCEL_TO_CONVEX_SECRET)],
    ['JARVIS_CONVEX_TO_VERCEL_SECRET', Boolean(parsed.JARVIS_CONVEX_TO_VERCEL_SECRET)],
  ]
    .filter(([, present]) => !present)
    .map(([field]) => field as string);
  if (invalid.length > 0) {
    throw new EnvironmentValidationError(invalid);
  }
}

function validateWhatsAppCloudIngestConfiguration(parsed: ParsedEnvironment): void {
  if (parsed.JARVIS_WHATSAPP_CLOUD_INGEST_ENABLED !== 'true') return;
  const invalid = [
    ['PROVIDER_INTEGRATIONS_ENABLED', parsed.PROVIDER_INTEGRATIONS_ENABLED === 'true'],
    ['JARVIS_OWNER_ID', Boolean(parsed.JARVIS_OWNER_ID)],
    ['JARVIS_INGEST_TOKEN', Boolean(parsed.JARVIS_INGEST_TOKEN)],
    [
      'JARVIS_WHATSAPP_CLOUD_INGEST_INSTANCE_ID',
      Boolean(parsed.JARVIS_WHATSAPP_CLOUD_INGEST_INSTANCE_ID),
    ],
    ['JARVIS_CONVEX_ORCHESTRATION_URL', Boolean(parsed.JARVIS_CONVEX_ORCHESTRATION_URL)],
    ['JARVIS_VERCEL_TO_CONVEX_SECRET', Boolean(parsed.JARVIS_VERCEL_TO_CONVEX_SECRET)],
    ['JARVIS_CONVEX_TO_VERCEL_SECRET', Boolean(parsed.JARVIS_CONVEX_TO_VERCEL_SECRET)],
  ]
    .filter(([, present]) => !present)
    .map(([field]) => field as string);
  if (invalid.length > 0) {
    throw new EnvironmentValidationError(invalid);
  }
}

function validateWhatsAppCloudOwnerConversationConfiguration(parsed: ParsedEnvironment): void {
  if (parsed.JARVIS_WHATSAPP_CLOUD_OWNER_DM_ENABLED !== 'true') return;
  const invalid = [
    ['PROVIDER_INTEGRATIONS_ENABLED', parsed.PROVIDER_INTEGRATIONS_ENABLED === 'true'],
    [
      'JARVIS_WHATSAPP_CLOUD_INGEST_ENABLED',
      parsed.JARVIS_WHATSAPP_CLOUD_INGEST_ENABLED === 'true',
    ],
    ['JARVIS_OWNER_ID', Boolean(parsed.JARVIS_OWNER_ID)],
    [
      'JARVIS_WHATSAPP_CLOUD_DELIVERY_BRIDGE_URL',
      Boolean(parsed.JARVIS_WHATSAPP_CLOUD_DELIVERY_BRIDGE_URL),
    ],
    ['JARVIS_WHATSAPP_CLOUD_DELIVERY_TOKEN', Boolean(parsed.JARVIS_WHATSAPP_CLOUD_DELIVERY_TOKEN)],
    [
      'JARVIS_WHATSAPP_CLOUD_DELIVERY_BRIDGE_ID',
      Boolean(parsed.JARVIS_WHATSAPP_CLOUD_DELIVERY_BRIDGE_ID),
    ],
    ['JARVIS_CONVEX_ORCHESTRATION_URL', Boolean(parsed.JARVIS_CONVEX_ORCHESTRATION_URL)],
    ['JARVIS_VERCEL_TO_CONVEX_SECRET', Boolean(parsed.JARVIS_VERCEL_TO_CONVEX_SECRET)],
    ['JARVIS_CONVEX_TO_VERCEL_SECRET', Boolean(parsed.JARVIS_CONVEX_TO_VERCEL_SECRET)],
  ]
    .filter(([, present]) => !present)
    .map(([field]) => field as string);
  if (invalid.length > 0) {
    throw new EnvironmentValidationError(invalid);
  }
}

function validateTelegramConfiguration(parsed: ParsedEnvironment): void {
  if (
    parsed.JARVIS_TELEGRAM_OWNER_DM_ENABLED === 'true' &&
    parsed.JARVIS_TELEGRAM_BOT_ENABLED !== 'true'
  ) {
    throw new EnvironmentValidationError(['JARVIS_TELEGRAM_BOT_ENABLED']);
  }
  if (parsed.JARVIS_TELEGRAM_BOT_ENABLED !== 'true') return;
  const invalid = [
    ['PROVIDER_INTEGRATIONS_ENABLED', parsed.PROVIDER_INTEGRATIONS_ENABLED === 'true'],
    ['JARVIS_OWNER_ID', Boolean(parsed.JARVIS_OWNER_ID)],
    ['JARVIS_TELEGRAM_BOT_TOKEN', Boolean(parsed.JARVIS_TELEGRAM_BOT_TOKEN)],
    ['JARVIS_TELEGRAM_WEBHOOK_SECRET', Boolean(parsed.JARVIS_TELEGRAM_WEBHOOK_SECRET)],
    ['JARVIS_TELEGRAM_OPERATOR_TOKEN', Boolean(parsed.JARVIS_TELEGRAM_OPERATOR_TOKEN)],
    ['JARVIS_CONVEX_ORCHESTRATION_URL', Boolean(parsed.JARVIS_CONVEX_ORCHESTRATION_URL)],
    ['JARVIS_VERCEL_TO_CONVEX_SECRET', Boolean(parsed.JARVIS_VERCEL_TO_CONVEX_SECRET)],
  ]
    .filter(([, present]) => !present)
    .map(([field]) => field as string);
  if (invalid.length > 0) throw new EnvironmentValidationError(invalid);
}

function toRuntimeEnvironment(parsed: ParsedEnvironment): RuntimeEnvironment {
  const openAi = {
    apiKey: parsed.OPENAI_API_KEY,
    fast: {
      model: parsed.JARVIS_OPENAI_FAST_MODEL,
      reasoningEffort: parsed.JARVIS_OPENAI_FAST_REASONING_EFFORT,
      reasoningMode: 'standard' as const,
      reasoningContext: 'current_turn' as const,
      verbosity: parsed.JARVIS_OPENAI_FAST_VERBOSITY,
      maxOutputTokens: parsed.JARVIS_OPENAI_FAST_MAX_OUTPUT_TOKENS,
      rateCard: {
        inputCostPerMillionUsd: parsed.JARVIS_OPENAI_FAST_INPUT_COST_PER_MILLION,
        cachedInputCostPerMillionUsd: parsed.JARVIS_OPENAI_FAST_CACHED_INPUT_COST_PER_MILLION,
        outputCostPerMillionUsd: parsed.JARVIS_OPENAI_FAST_OUTPUT_COST_PER_MILLION,
      },
    },
    standard: {
      model: parsed.JARVIS_OPENAI_STANDARD_MODEL,
      reasoningEffort: parsed.JARVIS_OPENAI_STANDARD_REASONING_EFFORT,
      reasoningMode: 'standard' as const,
      reasoningContext: 'current_turn' as const,
      verbosity: parsed.JARVIS_OPENAI_STANDARD_VERBOSITY,
      maxOutputTokens: parsed.JARVIS_OPENAI_STANDARD_MAX_OUTPUT_TOKENS,
      rateCard: {
        inputCostPerMillionUsd: parsed.JARVIS_OPENAI_STANDARD_INPUT_COST_PER_MILLION,
        cachedInputCostPerMillionUsd: parsed.JARVIS_OPENAI_STANDARD_CACHED_INPUT_COST_PER_MILLION,
        outputCostPerMillionUsd: parsed.JARVIS_OPENAI_STANDARD_OUTPUT_COST_PER_MILLION,
      },
    },
    deep: {
      model: parsed.JARVIS_OPENAI_DEEP_MODEL,
      reasoningEffort: parsed.JARVIS_OPENAI_DEEP_REASONING_EFFORT,
      reasoningMode: 'standard' as const,
      reasoningContext: 'current_turn' as const,
      verbosity: parsed.JARVIS_OPENAI_DEEP_VERBOSITY,
      maxOutputTokens: parsed.JARVIS_OPENAI_DEEP_MAX_OUTPUT_TOKENS,
      rateCard: {
        inputCostPerMillionUsd: parsed.JARVIS_OPENAI_DEEP_INPUT_COST_PER_MILLION,
        cachedInputCostPerMillionUsd: parsed.JARVIS_OPENAI_DEEP_CACHED_INPUT_COST_PER_MILLION,
        outputCostPerMillionUsd: parsed.JARVIS_OPENAI_DEEP_OUTPUT_COST_PER_MILLION,
      },
    },
  } satisfies OpenAiRuntimeConfiguration;

  const gatewayRoute = (
    model: string | undefined,
    route: OpenAiModelRouteConfiguration,
    rateCard: Pick<ModelRateCard, 'inputCostPerMillionUsd' | 'outputCostPerMillionUsd'>,
  ) => ({
    ...route,
    model: model ?? unconfiguredGatewayModelId,
    // A `null` value is intentionally not a zero-price claim. It tells the Free Tier safety guard
    // that a catalog-derived upper bound is missing, so the request must remain unavailable.
    rateCard: {
      inputCostPerMillionUsd: rateCard.inputCostPerMillionUsd,
      cachedInputCostPerMillionUsd: null,
      outputCostPerMillionUsd: rateCard.outputCostPerMillionUsd,
    },
  });
  const model = {
    provider: parsed.JARVIS_MODEL_PROVIDER,
    zeroCostMode: parsed.JARVIS_ZERO_COST_MODE === 'true',
    apiKey: parsed.JARVIS_MODEL_PROVIDER === 'openai-responses' ? parsed.OPENAI_API_KEY : undefined,
    oidcToken:
      parsed.JARVIS_MODEL_PROVIDER === 'vercel-ai-gateway' ? parsed.VERCEL_OIDC_TOKEN : undefined,
    verifiedFreeModelIds: verifiedModelIds(parsed.JARVIS_ZERO_COST_VERIFIED_MODEL_IDS),
    freeTierCreditGuard: {
      monthlyCreditGuardUsd: parsed.JARVIS_ZERO_COST_MONTHLY_CREDIT_GUARD_USD,
      reportedMonthlyUsageUsd: parsed.JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_USD,
      reportedMonthlyUsageAsOf: parsed.JARVIS_ZERO_COST_REPORTED_MONTHLY_USAGE_AS_OF,
    },
    fast:
      parsed.JARVIS_MODEL_PROVIDER === 'vercel-ai-gateway'
        ? gatewayRoute(parsed.JARVIS_VERCEL_AI_GATEWAY_FAST_MODEL, openAi.fast, {
            inputCostPerMillionUsd:
              parsed.JARVIS_VERCEL_AI_GATEWAY_FAST_INPUT_COST_PER_MILLION ?? null,
            outputCostPerMillionUsd:
              parsed.JARVIS_VERCEL_AI_GATEWAY_FAST_OUTPUT_COST_PER_MILLION ?? null,
          })
        : openAi.fast,
    standard:
      parsed.JARVIS_MODEL_PROVIDER === 'vercel-ai-gateway'
        ? gatewayRoute(parsed.JARVIS_VERCEL_AI_GATEWAY_STANDARD_MODEL, openAi.standard, {
            inputCostPerMillionUsd:
              parsed.JARVIS_VERCEL_AI_GATEWAY_STANDARD_INPUT_COST_PER_MILLION ?? null,
            outputCostPerMillionUsd:
              parsed.JARVIS_VERCEL_AI_GATEWAY_STANDARD_OUTPUT_COST_PER_MILLION ?? null,
          })
        : openAi.standard,
    deep:
      parsed.JARVIS_MODEL_PROVIDER === 'vercel-ai-gateway'
        ? gatewayRoute(parsed.JARVIS_VERCEL_AI_GATEWAY_DEEP_MODEL, openAi.deep, {
            inputCostPerMillionUsd:
              parsed.JARVIS_VERCEL_AI_GATEWAY_DEEP_INPUT_COST_PER_MILLION ?? null,
            outputCostPerMillionUsd:
              parsed.JARVIS_VERCEL_AI_GATEWAY_DEEP_OUTPUT_COST_PER_MILLION ?? null,
          })
        : openAi.deep,
  } satisfies ModelRuntimeConfiguration;

  const orchestration = {
    convexUrl: parsed.JARVIS_CONVEX_ORCHESTRATION_URL,
    vercelToConvexSecret: parsed.JARVIS_VERCEL_TO_CONVEX_SECRET,
    convexToVercelSecret: parsed.JARVIS_CONVEX_TO_VERCEL_SECRET,
    localBridgeToken: parsed.JARVIS_LOCAL_BRIDGE_TOKEN,
    localBridgeEnabled: parsed.JARVIS_LOCAL_BRIDGE_ENABLED === 'true',
    localBridgeOwnerId: parsed.JARVIS_LOCAL_BRIDGE_OWNER_ID,
    localBridgeConnectionId: parsed.JARVIS_LOCAL_BRIDGE_CONNECTION_ID,
    localBridgeOwnerTargetReference: parsed.JARVIS_LOCAL_BRIDGE_OWNER_TARGET_REFERENCE,
  } satisfies OrchestrationRuntimeConfiguration;

  const whatsappCloudIngest = {
    enabled: parsed.JARVIS_WHATSAPP_CLOUD_INGEST_ENABLED === 'true',
    accessToken: parsed.JARVIS_INGEST_TOKEN,
    expectedInstanceId: parsed.JARVIS_WHATSAPP_CLOUD_INGEST_INSTANCE_ID,
    ownerDirectMessagingEnabled: parsed.JARVIS_WHATSAPP_CLOUD_OWNER_DM_ENABLED === 'true',
    deliveryBridgeUrl: parsed.JARVIS_WHATSAPP_CLOUD_DELIVERY_BRIDGE_URL,
    deliveryToken: parsed.JARVIS_WHATSAPP_CLOUD_DELIVERY_TOKEN,
    deliveryBridgeId: parsed.JARVIS_WHATSAPP_CLOUD_DELIVERY_BRIDGE_ID,
  } satisfies WhatsAppCloudIngestRuntimeConfiguration;
  const telegramBot = {
    token: parsed.JARVIS_TELEGRAM_BOT_TOKEN,
    webhookSecret: parsed.JARVIS_TELEGRAM_WEBHOOK_SECRET,
    operatorToken: parsed.JARVIS_TELEGRAM_OPERATOR_TOKEN,
    enabled: parsed.JARVIS_TELEGRAM_BOT_ENABLED === 'true',
    ownerDirectMessagingEnabled: parsed.JARVIS_TELEGRAM_OWNER_DM_ENABLED === 'true',
  } satisfies TelegramBotRuntimeConfiguration;

  const brain = {
    maxContextRecords: parsed.JARVIS_BRAIN_MAX_CONTEXT_RECORDS,
    maxRecentMessages: parsed.JARVIS_BRAIN_MAX_RECENT_MESSAGES,
    maxApproxPromptTokens: parsed.JARVIS_BRAIN_MAX_APPROX_PROMPT_TOKENS,
    maxModelCallsPerCycle: parsed.JARVIS_BRAIN_MAX_MODEL_CALLS_PER_CYCLE,
    dailyModelSpendLimitUsd: parsed.JARVIS_BRAIN_DAILY_MODEL_SPEND_LIMIT_USD,
    dailyDeepCallLimit: parsed.JARVIS_BRAIN_DAILY_DEEP_CALL_LIMIT,
    deepEscalationEnabled: parsed.JARVIS_BRAIN_DEEP_ESCALATION_ENABLED === 'true',
    dailyProactiveMessageMinimum: parsed.JARVIS_BRAIN_DAILY_PROACTIVE_MESSAGE_MIN,
    dailyProactiveMessageMaximum: parsed.JARVIS_BRAIN_DAILY_PROACTIVE_MESSAGE_MAX,
  } satisfies BrainRuntimeConfiguration;

  if (brain.dailyProactiveMessageMinimum > brain.dailyProactiveMessageMaximum) {
    throw new EnvironmentValidationError([
      'JARVIS_BRAIN_DAILY_PROACTIVE_MESSAGE_MIN',
      'JARVIS_BRAIN_DAILY_PROACTIVE_MESSAGE_MAX',
    ]);
  }

  const evolution = {
    enabled: parsed.JARVIS_EVOLUTION_ENABLED === 'true',
    ownerId: parsed.JARVIS_OWNER_ID,
    whatsappInstance: parsed.JARVIS_WHATSAPP_INSTANCE,
    ownerPhone: parsed.JARVIS_OWNER_PHONE,
    ownerWhatsAppLid: parsed.JARVIS_OWNER_WHATSAPP_LID,
    baseUrl: parsed.EVOLUTION_BASE_URL,
    apiKey: parsed.EVOLUTION_API_KEY,
    webhookSecret: parsed.EVOLUTION_WEBHOOK_SECRET,
    providerBuildId: parsed.EVOLUTION_PROVIDER_BUILD_ID,
    baileysVersion: parsed.EVOLUTION_BAILEYS_VERSION,
    imageDigest: parsed.EVOLUTION_IMAGE_DIGEST,
    webhookMaxBodyBytes: parsed.EVOLUTION_WEBHOOK_MAX_BODY_BYTES,
    unstableSourceBuildAllowed: parsed.EVOLUTION_ALLOW_UNSTABLE_SOURCE_BUILD === 'true',
  } satisfies EvolutionRuntimeConfiguration;

  return {
    personalSystemRead: {
      token: parsed.JARVIS_PERSONAL_SYSTEM_READ_TOKEN,
      nextToken: parsed.JARVIS_PERSONAL_SYSTEM_READ_TOKEN_NEXT,
    },
    personalApps: {
      ...(parsed.OURHOURS_API_URL && parsed.OURHOURS_API_TOKEN
        ? { ourhours: { baseUrl: parsed.OURHOURS_API_URL, token: parsed.OURHOURS_API_TOKEN } }
        : {}),
      ...(parsed.GROWTH_API_URL && parsed.GROWTH_API_TOKEN
        ? { growth: { baseUrl: parsed.GROWTH_API_URL, token: parsed.GROWTH_API_TOKEN } }
        : {}),
      ...(parsed.IRON_API_URL && parsed.IRON_API_TOKEN
        ? { iron: { baseUrl: parsed.IRON_API_URL, token: parsed.IRON_API_TOKEN } }
        : {}),
    },
    appEnvironment: parsed.APP_ENV,
    appUrl: parsed.APP_URL ?? defaultAppUrl,
    apiUrl: parsed.API_URL ?? defaultApiUrl,
    userTimezone: parsed.USER_TIMEZONE ?? defaultUserTimezone,
    allowedUserEmail: parsed.ALLOWED_USER_EMAIL,
    databaseUrl: parsed.DATABASE_URL,
    testDatabaseUrl: parsed.JARVIS_TEST_DATABASE_URL,
    encryptionKeyCurrent: parsed.ENCRYPTION_KEY_CURRENT,
    encryptionKeyVersion: parsed.ENCRYPTION_KEY_VERSION,
    internalServiceTokenPepper: parsed.INTERNAL_SERVICE_TOKEN_PEPPER,
    apiPort: parsed.PORT ?? parsed.API_PORT,
    workerHealthPort: parsed.PORT ?? parsed.WORKER_HEALTH_PORT,
    stagingRuntimeTestToken: parsed.STAGING_RUNTIME_TEST_TOKEN,
    stagingPhase3d1RecoveryToken: parsed.STAGING_PHASE_3_6D1_RECOVERY_TOKEN,
    providerIntegrationsEnabled: parsed.PROVIDER_INTEGRATIONS_ENABLED === 'true',
    ownerId: parsed.JARVIS_OWNER_ID,
    evolution,
    whatsappCloudIngest,
    telegramBot,
    model,
    orchestration,
    openAi,
    brain,
  };
}

export function loadApiEnvironment(source: EnvironmentSource = process.env): RuntimeEnvironment {
  return parseRuntimeEnvironment(source);
}

export function loadWorkerEnvironment(source: EnvironmentSource = process.env): RuntimeEnvironment {
  return parseRuntimeEnvironment(source);
}

export function loadWebEnvironment(source: EnvironmentSource = process.env): WebEnvironment {
  const environment = parseRuntimeEnvironment(source);

  return {
    appEnvironment: environment.appEnvironment,
    appUrl: environment.appUrl,
    apiUrl: environment.apiUrl,
    userTimezone: environment.userTimezone,
    providerIntegrationsEnabled: environment.providerIntegrationsEnabled,
  };
}
