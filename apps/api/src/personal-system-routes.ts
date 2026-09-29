import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PersonalDailyContext, ServiceResponse } from '@jarvis/integrations';

export interface PersonalSystemRouteDependencies {
  readonly readToken: string;
  readonly nextReadToken?: string;
  readonly today: (query: Readonly<Record<string, string>>) => Promise<PersonalDailyContext>;
  readonly status: () => Promise<
    readonly {
      readonly sourceApp: string;
      readonly response?: ServiceResponse;
      readonly error?: string;
    }[]
  >;
  /** Canonical transaction: global per-owner limit plus metadata-only audit, before network I/O. */
  readonly admit: (
    resource: 'today' | 'status',
    credential: 'current' | 'next',
  ) => Promise<boolean>;
  readonly logRejection: (reason: 'unauthorized' | 'invalid_request' | 'unavailable') => void;
}
const digest = (value: string) => createHash('sha256').update(value).digest();
function credential(
  header: string | undefined,
  current: string,
  next?: string,
): 'current' | 'next' | undefined {
  if (!header?.startsWith('Bearer ') || header.length > 1031) return undefined;
  const candidate = digest(header.slice(7));
  const currentMatch = timingSafeEqual(candidate, digest(current));
  const nextMatch = timingSafeEqual(candidate, digest(next ?? current));
  return currentMatch ? 'current' : next && nextMatch ? 'next' : undefined;
}
function todayQuery(value: unknown): Readonly<Record<string, string>> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!['date', 'timezone'].includes(key) || typeof item !== 'string') return undefined;
    if (
      key === 'date' &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(item) ||
        Number.isNaN(Date.parse(item)) ||
        new Date(item).toISOString().slice(0, 10) !== item)
    )
      return undefined;
    if (key === 'timezone') {
      if (item.length > 80) return undefined;
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: item }).format();
      } catch {
        return undefined;
      }
    }
    result[key] = item;
  }
  return result;
}
export function registerPersonalSystemRoutes(
  app: FastifyInstance,
  dependencies?: PersonalSystemRouteDependencies,
): void {
  if (!dependencies?.readToken) return;
  for (const resource of ['today', 'status'] as const) {
    app.get(`/personal-system/${resource}`, async (request, reply) => {
      reply.header('cache-control', 'no-store');
      const authenticated = credential(
        request.headers.authorization,
        dependencies.readToken,
        dependencies.nextReadToken,
      );
      if (!authenticated) {
        dependencies.logRejection('unauthorized');
        return reply
          .code(401)
          .send({
            error: {
              code: 'unauthorized',
              message: 'A personal-system read credential is required.',
            },
          });
      }
      const query = todayQuery(request.query);
      if (!query || (resource === 'status' && Object.keys(query).length)) {
        dependencies.logRejection('invalid_request');
        return reply
          .code(400)
          .send({
            error: { code: 'invalid_request', message: 'Use a valid date and timezone only.' },
          });
      }
      try {
        if (!(await dependencies.admit(resource, authenticated)))
          return reply
            .header('retry-after', '60')
            .code(429)
            .send({ error: { code: 'rate_limited', message: 'Read limit reached.' } });
        const data =
          resource === 'today' ? await dependencies.today(query) : await dependencies.status();
        return { schemaVersion: 1, data, permissions: ['personal-system.read'] };
      } catch {
        dependencies.logRejection('unavailable');
        return reply
          .code(503)
          .send({
            error: { code: 'unavailable', message: 'Personal-system read is unavailable.' },
          });
      }
    });
  }
}
