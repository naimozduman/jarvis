import { z } from 'zod';

const applicationEnvironments = ['development', 'test', 'staging', 'production'] as const;
const booleanEnvironmentSchema = z.enum(['true', 'false']);

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
  PROVIDER_INTEGRATIONS_ENABLED: booleanEnvironmentSchema.default('false'),
  JARVIS_EVOLUTION_ENABLED: booleanEnvironmentSchema.default('false'),
  JARVIS_OWNER_ID: z.uuid().optional(),
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

export interface RuntimeEnvironment {
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
  readonly providerIntegrationsEnabled: boolean;
  readonly evolution: EvolutionRuntimeConfiguration;
  readonly openAi: OpenAiRuntimeConfiguration;
  readonly brain: BrainRuntimeConfiguration;
}

export type ModelReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type ModelVerbosity = 'low' | 'medium' | 'high';

export interface ModelRateCard {
  readonly inputCostPerMillionUsd: number;
  readonly cachedInputCostPerMillionUsd: number;
  readonly outputCostPerMillionUsd: number;
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

  validateEvolutionConfiguration(parsed.data);

  return toRuntimeEnvironment(parsed.data);
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
    providerIntegrationsEnabled: parsed.PROVIDER_INTEGRATIONS_ENABLED === 'true',
    evolution,
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
