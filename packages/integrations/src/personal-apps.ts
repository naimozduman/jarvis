/** Server-only owner-system connector. Never import this adapter into a browser bundle. */
export type PersonalApp = 'ourhours' | 'growth' | 'iron';
export type PersonalResource =
  'status' | 'today' | 'events' | 'tasks' | 'plans' | 'workouts' | 'growth';
export type JsonValue =
  null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };
export interface PersonalAppCredential {
  readonly baseUrl: string;
  readonly token: string;
}
export type PersonalAppConfiguration = Readonly<
  Partial<Record<PersonalApp, PersonalAppCredential>>
>;
export interface OwnerRecord {
  readonly id: string;
  readonly sourceApp: PersonalApp;
  readonly sourceRecordId: string;
  readonly ownerApp: PersonalApp;
  readonly recordType: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly syncVersion: number;
}
export interface ServiceResponse<T extends JsonValue = JsonValue> {
  readonly data: T;
  readonly [key: string]: JsonValue;
}
export interface OwnerWrite {
  readonly id?: string;
  readonly expectedVersion?: number;
  readonly payload: JsonObject;
}
/** Only the four Growth-owned log kinds currently supported by the service write API. */
export type GrowthLogInput = {
  readonly occurredAt: string;
  readonly source?: 'jarvis';
  readonly externalId?: string;
  readonly notes?: string;
} & (
  | { readonly type: 'water'; readonly payload: { readonly ml: number } }
  | { readonly type: 'weight'; readonly payload: { readonly kg: number } }
  | { readonly type: 'sleep'; readonly payload: { readonly minutes: number } }
  | { readonly type: 'custom'; readonly payload: { readonly name: string; readonly text: string } }
);
export type IronManualWorkout = {
  readonly name: string;
  readonly startedAt: string;
  readonly durationSeconds: number;
  readonly notes?: string | null;
  readonly perceivedEffort?: number | null;
} & (
  | {
      readonly kind: 'run';
      readonly environment: 'indoor' | 'outdoor';
      readonly distanceMeters: number;
    }
  | {
      readonly kind: 'strength';
      readonly exercises: readonly {
        readonly exerciseId: string;
        readonly notes?: string | null;
        readonly sets: readonly {
          readonly actualReps: number;
          readonly actualRir?: number | null;
          readonly actualRpe?: number | null;
          readonly actualWeightKg?: number | null;
          readonly notes?: string | null;
          readonly setKind?: 'warmup' | 'work';
        }[];
      }[];
    }
);
/** The owner applies its complete run/strength template validator to the JSON template. */
export interface IronWorkoutDraft {
  readonly schemaVersion: 1;
  readonly draftId: string;
  readonly kind: 'run' | 'strength';
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly template: JsonObject & {
    readonly kind: 'run' | 'strength';
    readonly schemaVersion: 1;
    readonly name: string;
  };
}
export interface IronWorkoutUpdate {
  readonly id: string;
  readonly expectedVersion: number;
  readonly name: string;
  readonly notes: string | null;
}
export interface GrowthWrite {
  readonly id?: string;
  readonly expectedVersion?: number;
  readonly input: GrowthLogInput;
}
export type PersonalAppFailureCode =
  | 'not_configured'
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict'
  | 'rate_limited'
  | 'unavailable'
  | 'invalid_response';
export class PersonalAppError extends Error {
  public constructor(
    public readonly app: PersonalApp,
    public readonly code: PersonalAppFailureCode,
    public readonly status?: number,
  ) {
    super(`Owner service ${app}: ${code}.`);
    this.name = 'PersonalAppError';
  }
}
export interface PersonalClientOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
  readonly readRetries?: number;
  readonly wait?: (milliseconds: number) => Promise<void>;
}
export type DailyAppContext =
  | {
      readonly sourceApp: PersonalApp;
      readonly status: 'available';
      readonly response: ServiceResponse;
    }
  | {
      readonly sourceApp: PersonalApp;
      readonly status: 'unavailable';
      readonly error: PersonalAppFailureCode;
    };
export interface PersonalDailyContext {
  readonly fetchedAt: string;
  readonly sources: readonly DailyAppContext[];
}

const apps = ['ourhours', 'growth', 'iron'] as const;
const resources: Readonly<Record<PersonalApp, readonly PersonalResource[]>> = {
  ourhours: ['status', 'today', 'events', 'tasks', 'plans', 'workouts'],
  growth: ['status', 'today', 'growth', 'workouts'],
  iron: ['status', 'today', 'workouts', 'plans'],
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxResponseBytes = 1_048_576;

function baseOrigin(app: PersonalApp, value: string): string {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !['', '/'].includes(url.pathname)
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new PersonalAppError(app, 'invalid_request');
  }
}
function errorCode(status: number): PersonalAppFailureCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate_limited';
  return status >= 500 ? 'unavailable' : 'invalid_request';
}
function isJson(value: unknown, depth = 0): value is JsonValue {
  if (depth > 30) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJson(item, depth + 1));
  return (
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value).every((item) => isJson(item, depth + 1))
  );
}
async function responseJson(app: PersonalApp, response: Response): Promise<ServiceResponse> {
  if (
    !response.headers.get('content-type')?.toLowerCase().includes('application/json') ||
    Number(response.headers.get('content-length') ?? 0) > maxResponseBytes
  )
    throw new PersonalAppError(app, 'invalid_response', response.status);
  const reader = response.body?.getReader();
  if (!reader) throw new PersonalAppError(app, 'invalid_response', response.status);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxResponseBytes)
        throw new PersonalAppError(app, 'invalid_response', response.status);
      chunks.push(part.value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder().decode(body));
    if (
      !isJson(value) ||
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !Object.hasOwn(value, 'data') ||
      Object.hasOwn(value, 'error')
    )
      throw new Error();
    return value as ServiceResponse;
  } catch (error) {
    if (error instanceof PersonalAppError) throw error;
    throw new PersonalAppError(app, 'invalid_response', response.status);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/** Credentials remain private fields. The caller owns policy, durable audit, and write scheduling. */
export class PersonalSystemClient {
  readonly #credentials: PersonalAppConfiguration;
  readonly #fetch: typeof globalThis.fetch;
  readonly #timeoutMs: number;
  readonly #readRetries: number;
  readonly #wait: (milliseconds: number) => Promise<void>;
  public constructor(configuration: PersonalAppConfiguration, options: PersonalClientOptions = {}) {
    if (typeof window !== 'undefined')
      throw new Error('Owner service client requires a server runtime.');
    this.#credentials = Object.fromEntries(
      apps.flatMap((app) => {
        const credential = configuration[app];
        if (!credential) return [];
        if (
          credential.token.length < 32 ||
          credential.token.length > 1024 ||
          /\s/.test(credential.token)
        )
          throw new PersonalAppError(app, 'invalid_request');
        return [[app, { baseUrl: baseOrigin(app, credential.baseUrl), token: credential.token }]];
      }),
    );
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#timeoutMs = Math.max(100, Math.min(options.timeoutMs ?? 5000, 10000));
    this.#readRetries = Math.max(0, Math.min(Math.floor(options.readRetries ?? 2), 2));
    this.#wait =
      options.wait ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }
  public read(
    app: PersonalApp,
    resource: PersonalResource,
    query: Readonly<Record<string, string>> = {},
  ): Promise<ServiceResponse> {
    return this.request(app, resource, 'GET', query);
  }
  /** Exactly one read per configured source, with bounded retries and explicit partial failures. */
  public async today(query: Readonly<Record<string, string>> = {}): Promise<PersonalDailyContext> {
    const sources = await Promise.all(
      apps.map(async (app): Promise<DailyAppContext> => {
        try {
          return {
            sourceApp: app,
            status: 'available',
            response: await this.read(app, 'today', query),
          };
        } catch (error) {
          return {
            sourceApp: app,
            status: 'unavailable',
            error: error instanceof PersonalAppError ? error.code : 'unavailable',
          };
        }
      }),
    );
    return { fetchedAt: new Date().toISOString(), sources };
  }
  public writeOurHours(
    resource: 'events' | 'tasks',
    method: 'POST' | 'PATCH',
    body: OwnerWrite,
    idempotencyKey: string,
  ): Promise<ServiceResponse> {
    return this.write('ourhours', resource, method, body, idempotencyKey);
  }
  public writeGrowth(
    method: 'POST' | 'PATCH',
    body: GrowthWrite,
    idempotencyKey: string,
  ): Promise<ServiceResponse> {
    if (!['water', 'weight', 'sleep', 'custom'].includes(body.input.type))
      throw new PersonalAppError('growth', 'invalid_request');
    return this.write('growth', 'growth', method, body, idempotencyKey);
  }
  public logIronWorkout(
    workout: IronManualWorkout,
    idempotencyKey: string,
  ): Promise<ServiceResponse> {
    return this.ironWrite('workouts', 'POST', { workout }, idempotencyKey);
  }
  public updateIronWorkout(
    update: IronWorkoutUpdate,
    idempotencyKey: string,
  ): Promise<ServiceResponse> {
    if (!update.id || !Number.isSafeInteger(update.expectedVersion) || update.expectedVersion < 1)
      throw new PersonalAppError('iron', 'invalid_request');
    return this.ironWrite('workouts', 'PATCH', update, idempotencyKey);
  }
  public deleteIronWorkout(id: string, idempotencyKey: string): Promise<ServiceResponse> {
    if (!id) throw new PersonalAppError('iron', 'invalid_request');
    return this.ironWrite('workouts', 'DELETE', { id }, idempotencyKey);
  }
  public saveIronPlan(draft: IronWorkoutDraft, idempotencyKey: string): Promise<ServiceResponse> {
    return this.ironWrite('plans', 'POST', { draft }, idempotencyKey);
  }
  private ironWrite(
    resource: 'workouts' | 'plans',
    method: 'POST' | 'PATCH' | 'DELETE',
    body: unknown,
    key: string,
  ): Promise<ServiceResponse> {
    if (!uuid.test(key) || !isJson(body)) throw new PersonalAppError('iron', 'invalid_request');
    return this.request('iron', resource, method, {}, body as JsonObject, key);
  }
  private write(
    app: PersonalApp,
    resource: PersonalResource,
    method: 'POST' | 'PATCH',
    body: OwnerWrite | GrowthWrite,
    key: string,
  ): Promise<ServiceResponse> {
    if (
      !uuid.test(key) ||
      (method === 'PATCH' &&
        (!body.id ||
          !Number.isSafeInteger(body.expectedVersion) ||
          (body.expectedVersion ?? 0) < 1)) ||
      !isJson(body)
    )
      throw new PersonalAppError(app, 'invalid_request');
    return this.request(app, resource, method, {}, body as unknown as JsonObject, key);
  }
  private async request(
    app: PersonalApp,
    resource: PersonalResource,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    query: Readonly<Record<string, string>>,
    body?: JsonObject,
    key?: string,
  ): Promise<ServiceResponse> {
    if (!resources[app]?.includes(resource)) throw new PersonalAppError(app, 'invalid_request');
    const credential = this.#credentials[app];
    if (!credential) throw new PersonalAppError(app, 'not_configured');
    const url = new URL(`/api/jarvis/${resource}`, credential.baseUrl);
    for (const [name, value] of Object.entries(query)) {
      if (name.length > 80 || value.length > 2000)
        throw new PersonalAppError(app, 'invalid_request');
      url.searchParams.set(name, value);
    }
    const attempts = method === 'GET' ? this.#readRetries + 1 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
      let failure: PersonalAppError;
      try {
        const response = await this.#fetch(url, {
          method,
          signal: controller.signal,
          redirect: 'error',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${credential.token}`,
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(key ? { 'Idempotency-Key': key } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (response.ok) return await responseJson(app, response);
        await response.body?.cancel().catch(() => undefined);
        failure = new PersonalAppError(app, errorCode(response.status), response.status);
      } catch (error) {
        failure =
          error instanceof PersonalAppError ? error : new PersonalAppError(app, 'unavailable');
      } finally {
        clearTimeout(timer);
      }
      if (attempt + 1 === attempts || !['unavailable', 'rate_limited'].includes(failure.code))
        throw failure;
      await this.#wait(100 * 2 ** attempt);
    }
    throw new PersonalAppError(app, 'unavailable');
  }
}
