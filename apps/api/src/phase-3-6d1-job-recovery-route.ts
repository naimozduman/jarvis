import type { FastifyInstance } from 'fastify';

import { Phase3d1RecoveryRefusedError } from './phase-3-6d1-job-recovery.js';
import { hasExpectedStagingBearerToken } from './staging-runtime-auth.js';

export interface Phase3d1JobRecoveryRouteDependencies {
  /** Never logged or returned. Its absence means the route is not registered. */
  readonly accessToken: string | undefined;
  readonly recover: () => Promise<{
    readonly jobId: string;
    readonly generation: 1;
    readonly published: true;
  }>;
}

/** A temporary staging-only transport for the fixed, pre-authorized recovery operation. */
export function registerPhase3d1JobRecoveryRoute(
  app: FastifyInstance,
  dependencies: Phase3d1JobRecoveryRouteDependencies | undefined,
): void {
  if (!dependencies?.accessToken) return;
  const accessToken = dependencies.accessToken;

  app.post('/internal/staging/phase-3-6d1-recover', async (request, reply) => {
    if (!hasExpectedStagingBearerToken(request.headers.authorization, accessToken)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    if (request.body !== undefined) {
      return reply.code(400).send({ error: 'invalid_recovery_request' });
    }
    try {
      const result = await dependencies.recover();
      return reply.code(202).send(result);
    } catch (error) {
      return error instanceof Phase3d1RecoveryRefusedError
        ? reply.code(409).send({ error: 'recovery_refused' })
        : reply.code(503).send({ error: 'recovery_publication_unavailable' });
    }
  });
}
