import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { ApplicationEnvironment } from '@jarvis/config';

import { StagingC7HarnessError, type StagingC7HarnessResult } from './staging-c7-harness.js';
import { hasExpectedStagingBearerToken } from './staging-runtime-auth.js';

export interface StagingC7HarnessRouteDependencies {
  readonly appEnvironment: ApplicationEnvironment;
  readonly ownerId: string | undefined;
  /** Never logged or returned. Its absence means this route does not exist. */
  readonly accessToken: string | undefined;
  /** Runs a fixed suite with no caller-supplied test selection or lifecycle inputs. */
  readonly runSuite: (() => Promise<StagingC7HarnessResult>) | undefined;
}

function emptyRequest(request: FastifyRequest): boolean {
  const query = request.query;
  const hasQuery = Boolean(query && typeof query === 'object' && Object.keys(query).length > 0);
  return !hasQuery && request.body === undefined;
}

/**
 * This is not an administration API. It is a single staging-only release-gate endpoint with a
 * fixed test sequence and no request body, query parameters, target identifiers, or actions.
 */
export function registerStagingC7HarnessRoutes(
  app: FastifyInstance,
  dependencies: StagingC7HarnessRouteDependencies | undefined,
): void {
  const ownerId = dependencies?.ownerId;
  const accessToken = dependencies?.accessToken;
  const runSuite = dependencies?.runSuite;
  if (
    !dependencies ||
    dependencies.appEnvironment !== 'staging' ||
    !ownerId ||
    !accessToken ||
    !runSuite
  ) {
    return;
  }

  app.post('/internal/staging/c7-lifecycle-suite', async (request, reply) => {
    if (!hasExpectedStagingBearerToken(request.headers.authorization, accessToken)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    if (!emptyRequest(request)) {
      return reply.code(400).send({ error: 'invalid_staging_c7_request' });
    }
    try {
      const result = await runSuite();
      return reply.header('cache-control', 'no-store').code(200).send(result);
    } catch (error) {
      if (error instanceof StagingC7HarnessError) {
        return reply
          .header('cache-control', 'no-store')
          .code(error.safeCode === 'fixture_not_ready' ? 409 : 503)
          .send({
            error: error.safeCode,
            ...(error.safeCase ? { case: error.safeCase } : {}),
          });
      }
      return reply.code(503).send({ error: 'staging_c7_unavailable' });
    }
  });
}
