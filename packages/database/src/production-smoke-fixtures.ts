import { and, eq, sql } from 'drizzle-orm';

import {
  type ProductionSmokeCaseId,
  productionSmokeFixtureIds,
  productionSmokeFixtureSource,
} from '@jarvis/contracts';

import type { JarvisDatabase } from './client.js';
import { commitments, dayPlans, owners, planBlocks, reminders } from './schema/index.js';

type SmokeFixtureIds = ReturnType<typeof productionSmokeFixtureIds>;

const smokeMetadata = (runId: string, caseId: ProductionSmokeCaseId): Record<string, unknown> => ({
  synthetic: true,
  source: productionSmokeFixtureSource,
  smokeRunId: runId,
  caseId,
  retention: 'durable_audit_evidence',
});

/**
 * Bounded fixture lifecycle for deployed smoke acceptance. It owns a deterministic synthetic
 * owner per UUID run and never accepts a caller-provided owner, table, predicate, or fixture ID.
 */
export class DrizzleProductionSmokeFixtureRepository {
  public constructor(private readonly database: JarvisDatabase) {}

  public async ensure(input: {
    readonly runId: string;
    readonly caseId: ProductionSmokeCaseId;
  }): Promise<{ readonly ownerId: string }> {
    const ids = productionSmokeFixtureIds(input.runId);
    await this.database.transaction(async (transaction) => {
      await transaction
        .insert(owners)
        .values({
          id: ids.owner,
          emailNormalized: `production-smoke-${input.runId}@synthetic.invalid`,
          displayName: `Production smoke ${input.runId}`,
          timezone: 'UTC',
          status: 'synthetic_smoke',
          isPrimary: false,
        })
        .onConflictDoNothing();

      const [owner] = await transaction
        .select({ emailNormalized: owners.emailNormalized, isPrimary: owners.isPrimary })
        .from(owners)
        .where(eq(owners.id, ids.owner))
        .limit(1);
      if (
        !owner ||
        owner.isPrimary ||
        owner.emailNormalized !== `production-smoke-${input.runId}@synthetic.invalid`
      ) {
        throw new Error('The production-smoke owner is unavailable or is not safely isolated.');
      }

      switch (input.caseId) {
        case 'grounded_context_question':
          await this.ensureNormalFixture(transaction, input.runId, input.caseId, ids);
          break;
        case 'reminder_behavior':
          await this.ensureReminderFixture(transaction, input.runId, input.caseId, ids);
          break;
        case 'case3_plan_application':
        case 'protected_anchor_overlap_rejection':
        case 'simulated_provider_failure':
          await this.ensurePlanFixture(transaction, input.runId, input.caseId, ids);
          break;
      }
    });
    return { ownerId: ids.owner };
  }

  /**
   * Removes only disposable state marked with this exact run ID. Plan proposals, actions,
   * executions, events, and conversations are intentionally retained as immutable audit evidence;
   * the day plan is archived rather than deleted because retained proposals reference it.
   */
  public async cleanup(input: { readonly runId: string }): Promise<void> {
    const ids = productionSmokeFixtureIds(input.runId);
    await this.database.transaction(async (transaction) => {
      const [owner] = await transaction
        .select({ emailNormalized: owners.emailNormalized, isPrimary: owners.isPrimary })
        .from(owners)
        .where(eq(owners.id, ids.owner))
        .limit(1);
      if (
        !owner ||
        owner.isPrimary ||
        owner.emailNormalized !== `production-smoke-${input.runId}@synthetic.invalid`
      ) {
        throw new Error(
          'Refusing production-smoke cleanup outside its exact synthetic owner scope.',
        );
      }

      // A validated Case 3 action creates a server-owned block with its canonical source. Limit
      // that deletion by the exact smoke owner, day plan, and synthetic commitment; all other
      // rows require the exact source marker and cannot be selected by this lifecycle.
      await transaction.execute(sql`
        delete from jarvis.plan_blocks
        where owner_id = ${ids.owner}::uuid
          and (
            source = ${productionSmokeFixtureSource}
            or (
              day_plan_id = ${ids.planDayPlan}::uuid
              and commitment_id = ${ids.planCommitment}::uuid
              and source = 'brain_validated_plan'
            )
          )
      `);
      await transaction
        .delete(reminders)
        .where(
          and(eq(reminders.ownerId, ids.owner), eq(reminders.source, productionSmokeFixtureSource)),
        );
      await transaction
        .delete(commitments)
        .where(
          and(
            eq(commitments.ownerId, ids.owner),
            eq(commitments.source, productionSmokeFixtureSource),
          ),
        );
      await transaction
        .update(dayPlans)
        .set({ status: 'archived' })
        .where(
          and(eq(dayPlans.ownerId, ids.owner), eq(dayPlans.source, productionSmokeFixtureSource)),
        );
    });
  }

  private async ensureNormalFixture(
    transaction: Parameters<JarvisDatabase['transaction']>[0] extends (tx: infer T) => unknown
      ? T
      : never,
    runId: string,
    caseId: ProductionSmokeCaseId,
    ids: SmokeFixtureIds,
  ): Promise<void> {
    await this.ensureCommitment(transaction, {
      id: ids.normalDeadline,
      ownerId: ids.owner,
      runId,
      caseId,
      title: 'submit synthetic report',
      priority: 50,
      minimumAcceptableVersion: 'Keep the synthetic report open until evidence is supplied.',
    });
    await this.ensureDayPlan(transaction, {
      id: ids.normalDayPlan,
      ownerId: ids.owner,
      runId,
      caseId,
      localDate: '2099-04-06',
    });
    await this.ensurePlanBlock(transaction, {
      id: ids.normalSchedule,
      ownerId: ids.owner,
      dayPlanId: ids.normalDayPlan,
      runId,
      caseId,
      title: 'Synthetic fixed work block',
      blockKind: 'fixed',
      role: 'work_block',
      anchorClass: 'fixed',
      priority: 50,
      startAt: '2099-04-06T09:00:00.000Z',
      endAt: '2099-04-06T17:00:00.000Z',
      estimatedDurationMinutes: 480,
      reasonForPlacement: 'Fixed synthetic production-smoke schedule evidence.',
    });
  }

  private async ensureReminderFixture(
    transaction: Parameters<JarvisDatabase['transaction']>[0] extends (tx: infer T) => unknown
      ? T
      : never,
    runId: string,
    caseId: ProductionSmokeCaseId,
    ids: SmokeFixtureIds,
  ): Promise<void> {
    await this.ensureCommitment(transaction, {
      id: ids.reminderCommitment,
      ownerId: ids.owner,
      runId,
      caseId,
      title: 'call synthetic pharmacy',
      priority: 60,
      minimumAcceptableVersion: 'Place the call before the supplied synthetic deadline.',
    });
  }

  private async ensurePlanFixture(
    transaction: Parameters<JarvisDatabase['transaction']>[0] extends (tx: infer T) => unknown
      ? T
      : never,
    runId: string,
    caseId: ProductionSmokeCaseId,
    ids: SmokeFixtureIds,
  ): Promise<void> {
    await this.ensureCommitment(transaction, {
      id: ids.planCommitment,
      ownerId: ids.owner,
      runId,
      caseId,
      title: 'finish synthetic admin task',
      priority: 80,
      minimumAcceptableVersion: 'Complete a 30-minute minimum viable version tonight.',
    });
    await this.ensureDayPlan(transaction, {
      id: ids.planDayPlan,
      ownerId: ids.owner,
      runId,
      caseId,
      localDate: '2099-04-07',
    });
    await this.ensurePlanBlock(transaction, {
      id: ids.planHardAnchor,
      ownerId: ids.owner,
      dayPlanId: ids.planDayPlan,
      runId,
      caseId,
      title: 'Synthetic fixed external appointment',
      blockKind: 'fixed',
      role: 'hard_external_anchor',
      anchorClass: 'hard_external_anchor',
      priority: 100,
      startAt: '2099-04-07T16:00:00.000Z',
      endAt: '2099-04-07T17:00:00.000Z',
      estimatedDurationMinutes: 60,
      reasonForPlacement: 'Fixed synthetic production-smoke fixture constraint.',
    });
  }

  private async ensureCommitment(
    transaction: Parameters<JarvisDatabase['transaction']>[0] extends (tx: infer T) => unknown
      ? T
      : never,
    input: {
      readonly id: string;
      readonly ownerId: string;
      readonly runId: string;
      readonly caseId: ProductionSmokeCaseId;
      readonly title: string;
      readonly priority: number;
      readonly minimumAcceptableVersion: string;
    },
  ): Promise<void> {
    await transaction
      .insert(commitments)
      .values({
        id: input.id,
        ownerId: input.ownerId,
        title: input.title,
        status: 'open',
        priority: input.priority,
        flexibility: 'flexible',
        source: productionSmokeFixtureSource,
        minimumAcceptableVersion: input.minimumAcceptableVersion,
        followUpState: 'required',
        metadata: smokeMetadata(input.runId, input.caseId),
      })
      .onConflictDoNothing();
  }

  private async ensureDayPlan(
    transaction: Parameters<JarvisDatabase['transaction']>[0] extends (tx: infer T) => unknown
      ? T
      : never,
    input: {
      readonly id: string;
      readonly ownerId: string;
      readonly runId: string;
      readonly caseId: ProductionSmokeCaseId;
      readonly localDate: string;
    },
  ): Promise<void> {
    await transaction
      .insert(dayPlans)
      .values({
        id: input.id,
        ownerId: input.ownerId,
        localDate: input.localDate,
        timezone: 'UTC',
        status: 'active',
        revision: 1,
        source: productionSmokeFixtureSource,
        metadata: smokeMetadata(input.runId, input.caseId),
      })
      .onConflictDoNothing();
  }

  private async ensurePlanBlock(
    transaction: Parameters<JarvisDatabase['transaction']>[0] extends (tx: infer T) => unknown
      ? T
      : never,
    input: {
      readonly id: string;
      readonly ownerId: string;
      readonly dayPlanId: string;
      readonly runId: string;
      readonly caseId: ProductionSmokeCaseId;
      readonly title: string;
      readonly blockKind: 'fixed' | 'flexible';
      readonly role: 'hard_external_anchor' | 'work_block';
      readonly anchorClass: 'fixed' | 'hard_external_anchor';
      readonly priority: number;
      readonly startAt: string;
      readonly endAt: string;
      readonly estimatedDurationMinutes: number;
      readonly reasonForPlacement: string;
    },
  ): Promise<void> {
    await transaction
      .insert(planBlocks)
      .values({
        id: input.id,
        ownerId: input.ownerId,
        dayPlanId: input.dayPlanId,
        blockKind: input.blockKind,
        role: input.role,
        anchorClass: input.anchorClass,
        priority: input.priority,
        completionState: 'planned',
        title: input.title,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        source: productionSmokeFixtureSource,
        reasonForPlacement: input.reasonForPlacement,
        metadata: smokeMetadata(input.runId, input.caseId),
      })
      .onConflictDoNothing();
  }
}
