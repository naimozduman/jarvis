import { randomUUID } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { JarvisDatabase } from './client.js';
import { auditEvents } from './schema/index.js';

/** Shared across stateless invocations. No process-memory limiter or additional schema is needed. */
export class PersonalSystemReadAccess {
  public constructor(
    private readonly database: JarvisDatabase,
    private readonly ownerId: string,
  ) {}
  public async admit(
    resource: 'today' | 'status',
    credential: 'current' | 'next',
  ): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${this.ownerId}), hashtext('personal-system-read'))`,
      );
      const [row] = await transaction
        .select({ count: sql<number>`count(*)::int` })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.ownerId, this.ownerId),
            eq(auditEvents.action, 'personal_system.read.accepted'),
            gte(auditEvents.occurredAt, sql`now() - interval '60 seconds'`),
          ),
        );
      const allowed = (row?.count ?? 0) < 30;
      await transaction.insert(auditEvents).values({
        id: randomUUID(),
        ownerId: this.ownerId,
        actorType: 'service',
        actorId: null,
        action: allowed ? 'personal_system.read.accepted' : 'personal_system.read.rate_limited',
        targetType: 'personal_system',
        targetId: this.ownerId,
        occurredAt: sql`now()`,
        correlationId: randomUUID(),
        source: 'personal_system_gateway',
        metadata: { resource, credential, permission: 'personal-system.read' },
      });
      return allowed;
    });
  }
}
