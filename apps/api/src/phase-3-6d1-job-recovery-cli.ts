import { loadApiEnvironment } from '@jarvis/config';
import { createDatabaseRuntime, DrizzleDurableJobLifecycleProjection } from '@jarvis/database';
import { ConvexHttpOrchestrationPublisher } from '@jarvis/orchestration';

import { recoverPhase3d1ExistingJob } from './phase-3-6d1-job-recovery.js';

async function main(): Promise<void> {
  const environment = loadApiEnvironment(process.env);
  if (
    environment.appEnvironment !== 'staging' ||
    !environment.databaseUrl ||
    !environment.orchestration.convexUrl ||
    !environment.orchestration.vercelToConvexSecret
  ) {
    throw new Error('phase_3_6d1_recovery_not_configured');
  }

  const database = createDatabaseRuntime({
    connectionString: environment.databaseUrl,
    maxConnections: 1,
    connectionTimeoutMillis: 5_000,
  });
  try {
    await database.verifyConnection();
    await database.verifySchemaCompatibility();
    const result = await recoverPhase3d1ExistingJob({
      jobs: new DrizzleDurableJobLifecycleProjection(database.db),
      orchestration: new ConvexHttpOrchestrationPublisher({
        baseUrl: environment.orchestration.convexUrl,
        secret: environment.orchestration.vercelToConvexSecret,
      }),
    });
    process.stdout.write(`${JSON.stringify({ status: 'published', ...result })}\n`);
  } finally {
    await database.close().catch(() => undefined);
  }
}

void main().catch(() => {
  process.stderr.write('{"status":"failed","error":"phase_3_6d1_recovery_failed"}\n');
  process.exitCode = 1;
});
