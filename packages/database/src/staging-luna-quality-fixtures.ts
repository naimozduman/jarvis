import { and, eq } from 'drizzle-orm';

import {
  type SyntheticBrainQualityCaseId,
  syntheticBrainQualityFixtureIds,
  syntheticBrainQualityFixtureSource,
} from '@jarvis/contracts';

import type { JarvisDatabase } from './client.js';
import { commitments, dayPlans, planBlocks } from './schema/index.js';

const fixtureMetadata = (caseId: SyntheticBrainQualityCaseId): Record<string, unknown> => ({
  synthetic: true,
  suite: 'luna_quality_2026_09_29',
  caseId,
  retention: 'explicit_test_evidence',
});

/**
 * Creates only the minimal owner-scoped canonical rows needed for the fixed staging quality
 * cases. These rows are deliberately dated in 2099 and source-tagged so they cannot be mistaken
 * for real plans, reminders, or owner commitments.
 */
export class DrizzleStagingLunaQualityFixtureRepository {
  public constructor(private readonly database: JarvisDatabase) {}

  public async ensure(input: {
    readonly ownerId: string;
    readonly caseId: SyntheticBrainQualityCaseId;
  }): Promise<void> {
    if (input.caseId === 'normal_question') {
      await this.ensureCommitment({
        id: syntheticBrainQualityFixtureIds.normalDeadline,
        ownerId: input.ownerId,
        caseId: input.caseId,
        title: 'submit synthetic report',
        priority: 50,
        minimumAcceptableVersion: 'Keep the synthetic report open until evidence is supplied.',
      });
      await this.ensureDayPlan({
        id: syntheticBrainQualityFixtureIds.normalDayPlan,
        ownerId: input.ownerId,
        caseId: input.caseId,
        localDate: '2099-04-06',
      });
      await this.ensurePlanBlock({
        id: syntheticBrainQualityFixtureIds.normalSchedule,
        ownerId: input.ownerId,
        caseId: input.caseId,
        dayPlanId: syntheticBrainQualityFixtureIds.normalDayPlan,
        title: 'Synthetic fixed work block',
        blockKind: 'fixed',
        role: 'work_block',
        anchorClass: 'fixed',
        priority: 50,
        startAt: '2099-04-06T09:00:00.000Z',
        endAt: '2099-04-06T17:00:00.000Z',
        estimatedDurationMinutes: 480,
        minimumDurationMinutes: null,
        reasonForPlacement: 'Fixed synthetic schedule evidence for the Luna quality suite.',
      });
      return;
    }

    if (input.caseId === 'reminder_request') {
      await this.ensureCommitment({
        id: syntheticBrainQualityFixtureIds.reminderCommitment,
        ownerId: input.ownerId,
        caseId: input.caseId,
        title: 'call synthetic pharmacy',
        priority: 60,
        minimumAcceptableVersion: 'Place the call before the supplied synthetic deadline.',
      });
      return;
    }

    if (input.caseId === 'plan_change_request') {
      await this.ensureCommitment({
        id: syntheticBrainQualityFixtureIds.planCommitment,
        ownerId: input.ownerId,
        caseId: input.caseId,
        title: 'finish synthetic admin task',
        priority: 80,
        minimumAcceptableVersion: 'Complete a 30-minute minimum viable version tonight.',
      });
      await this.ensureDayPlan({
        id: syntheticBrainQualityFixtureIds.planDayPlan,
        ownerId: input.ownerId,
        caseId: input.caseId,
        localDate: '2099-04-07',
      });
      await this.ensurePlanBlock({
        id: syntheticBrainQualityFixtureIds.planHardAnchor,
        ownerId: input.ownerId,
        caseId: input.caseId,
        dayPlanId: syntheticBrainQualityFixtureIds.planDayPlan,
        title: 'Synthetic fixed external appointment',
        blockKind: 'fixed',
        role: 'hard_external_anchor',
        anchorClass: 'hard_external_anchor',
        priority: 100,
        startAt: '2099-04-07T16:00:00.000Z',
        endAt: '2099-04-07T17:00:00.000Z',
        estimatedDurationMinutes: 60,
        minimumDurationMinutes: null,
        reasonForPlacement: 'Fixed synthetic fixture constraint for the Luna quality suite.',
      });
    }
  }

  private async ensureCommitment(input: {
    readonly id: string;
    readonly ownerId: string;
    readonly caseId: SyntheticBrainQualityCaseId;
    readonly title: string;
    readonly priority: number;
    readonly minimumAcceptableVersion: string;
  }): Promise<void> {
    await this.database
      .insert(commitments)
      .values({
        id: input.id,
        ownerId: input.ownerId,
        title: input.title,
        status: 'open',
        priority: input.priority,
        flexibility: 'flexible',
        source: syntheticBrainQualityFixtureSource,
        minimumAcceptableVersion: input.minimumAcceptableVersion,
        followUpState: 'required',
        metadata: fixtureMetadata(input.caseId),
      })
      .onConflictDoNothing();

    const [row] = await this.database
      .select({ ownerId: commitments.ownerId, source: commitments.source })
      .from(commitments)
      .where(eq(commitments.id, input.id))
      .limit(1);
    if (
      !row ||
      row.ownerId !== input.ownerId ||
      row.source !== syntheticBrainQualityFixtureSource
    ) {
      throw new Error(
        'A staging Luna quality commitment fixture is unavailable or owner-mismatched.',
      );
    }
  }

  private async ensureDayPlan(input: {
    readonly id: string;
    readonly ownerId: string;
    readonly caseId: SyntheticBrainQualityCaseId;
    readonly localDate: string;
  }): Promise<void> {
    await this.database
      .insert(dayPlans)
      .values({
        id: input.id,
        ownerId: input.ownerId,
        localDate: input.localDate,
        timezone: 'UTC',
        status: 'active',
        revision: 1,
        source: syntheticBrainQualityFixtureSource,
        metadata: fixtureMetadata(input.caseId),
      })
      .onConflictDoNothing();

    const [row] = await this.database
      .select({ ownerId: dayPlans.ownerId, source: dayPlans.source, localDate: dayPlans.localDate })
      .from(dayPlans)
      .where(and(eq(dayPlans.id, input.id), eq(dayPlans.ownerId, input.ownerId)))
      .limit(1);
    if (
      !row ||
      row.source !== syntheticBrainQualityFixtureSource ||
      String(row.localDate) !== input.localDate
    ) {
      throw new Error(
        'A staging Luna quality day-plan fixture is unavailable or owner-mismatched.',
      );
    }
  }

  private async ensurePlanBlock(input: {
    readonly id: string;
    readonly ownerId: string;
    readonly caseId: SyntheticBrainQualityCaseId;
    readonly dayPlanId: string;
    readonly title: string;
    readonly blockKind: 'fixed' | 'flexible';
    readonly role: 'hard_external_anchor' | 'work_block';
    readonly anchorClass: 'fixed' | 'hard_external_anchor';
    readonly priority: number;
    readonly startAt: string;
    readonly endAt: string;
    readonly estimatedDurationMinutes: number;
    readonly minimumDurationMinutes: number | null;
    readonly reasonForPlacement: string;
  }): Promise<void> {
    await this.database
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
        minimumDurationMinutes: input.minimumDurationMinutes ?? undefined,
        source: syntheticBrainQualityFixtureSource,
        reasonForPlacement: input.reasonForPlacement,
        metadata: fixtureMetadata(input.caseId),
      })
      .onConflictDoNothing();

    const [row] = await this.database
      .select({
        ownerId: planBlocks.ownerId,
        dayPlanId: planBlocks.dayPlanId,
        source: planBlocks.source,
      })
      .from(planBlocks)
      .where(eq(planBlocks.id, input.id))
      .limit(1);
    if (
      !row ||
      row.ownerId !== input.ownerId ||
      row.dayPlanId !== input.dayPlanId ||
      row.source !== syntheticBrainQualityFixtureSource
    ) {
      throw new Error(
        'A staging Luna quality plan-block fixture is unavailable or owner-mismatched.',
      );
    }
  }
}
