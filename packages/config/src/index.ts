import { z } from 'zod';

const applicationEnvironments = ['development', 'test', 'production'] as const;

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
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(4100),
  PROVIDER_INTEGRATIONS_ENABLED: z.literal('false').default('false'),
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
  readonly providerIntegrationsEnabled: false;
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

export interface WebEnvironment {
  readonly appEnvironment: ApplicationEnvironment;
  readonly appUrl: string;
  readonly apiUrl: string;
  readonly userTimezone: string;
  readonly providerIntegrationsEnabled: false;
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
  const missingProductionFields =
    source.APP_ENV === 'production'
      ? productionRequiredKeys.filter((key) => !isPresent(source, key))
      : [];
  const invalidFields = parsed.success ? [] : validationFields(parsed.error);
  const fields = [...missingProductionFields, ...invalidFields];

  if (fields.length > 0) {
    throw new EnvironmentValidationError(fields);
  }

  if (!parsed.success) {
    throw new EnvironmentValidationError(['APP_ENV']);
  }

  return toRuntimeEnvironment(parsed.data);
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
    apiPort: parsed.API_PORT,
    workerHealthPort: parsed.WORKER_HEALTH_PORT,
    providerIntegrationsEnabled: false,
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
