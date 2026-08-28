import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq, sql } from 'drizzle-orm';
import { PgBoss, fromDrizzle } from 'pg-boss';
import { Pool } from 'pg';
import { describe, expect, test } from 'vitest';

import { events, jobs, owners } from '@jarvis/database';

const testDatabaseUrl = process.env.JARVIS_TEST_DATABASE_URL;
const integrationMigrations = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle');

function assertDedicatedTestDatabase(url: string): void {
  const parsed = new URL(url);
  const identifier = `${parsed.hostname}${parsed.pathname}`.toLowerCase();

  if (!identifier.includes('test')) {
    throw new Error(
      'JARVIS_TEST_DATABASE_URL must point to an explicitly named disposable test database.',
    );
  }
}

describe('optional PostgreSQL integration', () => {
  test.skipIf(!testDatabaseUrl)(
    'migrates and rolls back the atomic event/job transport boundary',
    async () => {
      const url = testDatabaseUrl;
      if (!url) {
        return;
      }

      assertDedicatedTestDatabase(url);
      const pool = new Pool({ connectionString: url, max: 1 });
      const database = drizzle({ client: pool });
      const boss = new PgBoss({ connectionString: url, schema: 'pgboss' });
      const ownerId = randomUUID();
      const eventId = randomUUID();
      const jobId = randomUUID();

      try {
        await migrate(database, { migrationsFolder: integrationMigrations });
        await boss.start();
        await boss.createQueue('jarvis.integration', { deleteAfterSeconds: 0 });

        await expect(
          database.transaction(async (transaction) => {
            await transaction.insert(owners).values({
              id: ownerId,
              emailNormalized: `${ownerId}@test.invalid`,
              displayName: 'Integration Test Owner',
              timezone: 'UTC',
              isPrimary: false,
            });
            await transaction.insert(events).values({
              id: eventId,
              ownerId,
              eventType: 'internal.test.v1',
              source: 'internal',
              idempotencyKey: `event:${eventId}`,
              occurredAt: new Date(),
              receivedAt: new Date(),
              payload: { kind: 'atomicity-test' },
              payloadHash: '0'.repeat(64),
              schemaVersion: 1,
              processingStatus: 'queued',
              correlationId: randomUUID(),
            });
            await transaction.insert(jobs).values({
              id: jobId,
              ownerId,
              jobType: 'jarvis.integration',
              payload: { eventId },
              scheduledFor: new Date(),
              availableAfter: new Date(),
              maximumAttempts: 1,
              correlationId: randomUUID(),
              sourceEventId: eventId,
              idempotencyKey: `job:${jobId}`,
            });
            await boss.send(
              'jarvis.integration',
              { eventId },
              {
                db: fromDrizzle(transaction, sql),
                id: jobId,
              },
            );

            throw new Error('intentional transaction rollback');
          }),
        ).rejects.toThrow('intentional transaction rollback');

        const [event] = await database.select().from(events).where(eq(events.id, eventId));
        const queued = await boss.findJobs('jarvis.integration', { id: jobId });

        expect(event).toBeUndefined();
        expect(queued).toHaveLength(0);
      } finally {
        await boss.stop().catch(() => undefined);
        await pool.end();
      }
    },
  );
});
