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
  ENCRYPTION_KEY_CURRENT: z.string().min(32).optional(),
  ENCRYPTION_KEY_VERSION: z.coerce.number().int().positive().default(1),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(4100),
  PROVIDER_INTEGRATIONS_ENABLED: z.literal('false').default('false'),
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
  readonly encryptionKeyCurrent: string | undefined;
  readonly encryptionKeyVersion: number;
  readonly apiPort: number;
  readonly workerHealthPort: number;
  readonly providerIntegrationsEnabled: false;
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
  return {
    appEnvironment: parsed.APP_ENV,
    appUrl: parsed.APP_URL ?? defaultAppUrl,
    apiUrl: parsed.API_URL ?? defaultApiUrl,
    userTimezone: parsed.USER_TIMEZONE ?? defaultUserTimezone,
    allowedUserEmail: parsed.ALLOWED_USER_EMAIL,
    databaseUrl: parsed.DATABASE_URL,
    encryptionKeyCurrent: parsed.ENCRYPTION_KEY_CURRENT,
    encryptionKeyVersion: parsed.ENCRYPTION_KEY_VERSION,
    apiPort: parsed.API_PORT,
    workerHealthPort: parsed.WORKER_HEALTH_PORT,
    providerIntegrationsEnabled: false,
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
