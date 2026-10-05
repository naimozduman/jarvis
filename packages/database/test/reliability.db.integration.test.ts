import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { and, eq, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, test } from 'vitest';

import type {
  BrainDecision,
  BrainRequest,
  ModelRequestAdmission,
  ModelRun,
  PlanBlock,
  PlanProposal,
  ProposedAction,
} from '@jarvis/contracts';
import {
  CanonicalPlanValidationError,
  validatePlanProposal,
  commitmentPlanBlock,
} from '@jarvis/contracts';
import { processProposedAction } from '@jarvis/domain';
import { evaluatePolicy } from '@jarvis/security';

import { DrizzleBrainRepository } from '../src/brain-repository.js';
import { createDatabaseRuntime } from '../src/client.js';
import { DrizzleTransactionalEventStore } from '../src/event-store.js';
import { CanonicalOnlyDurableJobTransport } from '../src/jobs.js';
import {
  brainRequests,
  commitments,
  dayPlans,
  events,
  modelRuns,
  owners,
  planBlockDependencies,
  planBlocks,
  planProposals,
  proposedActions,
} from '../src/schema/index.js';

// Deliberately separate from existing local-only suites: there is no fallback to any ordinary
// DATABASE_URL or JARVIS_TEST_DATABASE_URL. This exact endpoint was created for synthetic testing.
const reliabilityDatabaseUrl = process.env.JARVIS_RELIABILITY_TEST_DATABASE_URL;
const isolatedTestEndpoint = 'ep-purple-cloud-ayprvn63-pooler.c-5.us-east-2.aws.neon.tech';
const migrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle');

function assertIsolatedReliabilityDatabase(value: string): void {
  const url = new URL(value);
  if (url.hostname !== isolatedTestEndpoint || url.pathname !== '/jarvis_reliability_test') {
    throw new Error(
      'Reliability integration requires the explicitly provisioned isolated endpoint and jarvis_reliability_test database.',
    );
  }
}

describe('isolated synthetic reliability PostgreSQL integration', () => {
  test.skipIf(!reliabilityDatabaseUrl)(
    'migrates and persists complete accounting, denied admission, canonical deltas and idempotent effects',
    async () => {
      const url = reliabilityDatabaseUrl;
      if (!url) return;
      assertIsolatedReliabilityDatabase(url);
      const runtime = createDatabaseRuntime({
        connectionString: url,
        maxConnections: 2,
        connectionTimeoutMillis: 15_000,
      });
      const database = runtime.db;
      const repository = new DrizzleBrainRepository(database);
      const ownerId = randomUUID();
      const correlationId = randomUUID();
      const requestId = randomUUID();
      const eventId = randomUUID();
      const planId = randomUUID();
      const anchorId = randomUUID();
      const workId = randomUUID();
      const decisionId = randomUUID();
      const now = new Date().toISOString();
      const admission: ModelRequestAdmission = {
        requestHash: 'synthetic-full-request-hash',
        modelId: 'openai/gpt-6-luna',
        providerScope: 'openai',
        reasoningEffort: 'medium',
        measurementMethod: 'provider_count',
        measuredInputTokens: 4500,
        safetyMarginTokens: 1000,
        fullRequestInputTokens: 5500,
        maxInputTokens: 6000,
        maxOutputTokens: 2500,
        outputLimitSemantics: 'total_including_reasoning',
        allowed: true,
        reason: 'Synthetic bounded accounting fixture.',
        errorCategory: null,
        requestBytes: 12000,
        instructionsBytes: 3000,
        inputBytes: 2000,
        schemaBytes: 6500,
        measuredAt: now,
      };
      const request: BrainRequest = {
        id: requestId,
        ownerId,
        conversationId: null,
        sourceEventId: eventId,
        messageId: null,
        purpose: 'replan',
        idempotencyKey: `synthetic-reliability:${requestId}`,
        correlationId,
        causationId: null,
        requestedAt: now,
        state: 'received',
      };
      const canonical: PlanBlock = {
        id: anchorId,
        ownerId,
        dayPlanId: planId,
        commitmentId: null,
        title: 'Synthetic fixed appointment',
        role: 'hard_external_anchor',
        anchorClass: 'hard_external_anchor',
        priority: 100,
        startAt: '2099-04-07T16:00:00.000Z',
        endAt: '2099-04-07T17:00:00.000Z',
        earliestStartAt: null,
        latestFinishAt: null,
        estimatedDurationMinutes: 60,
        minimumDurationMinutes: null,
        dependencyIds: [],
        completionState: 'planned',
        reasonForPlacement: 'Synthetic canonical fixture.',
        source: 'synthetic_reliability_fixture',
      };
      const work: PlanBlock = {
        ...canonical,
        id: workId,
        title: 'Synthetic admin work',
        role: 'work_block',
        anchorClass: 'flexible',
        priority: 50,
        startAt: '2099-04-07T17:30:00.000Z',
        endAt: '2099-04-07T18:00:00.000Z',
        estimatedDurationMinutes: 30,
        dependencyIds: [anchorId],
      };
      const proposal = (blocks: PlanBlock[], existing: PlanBlock[]): PlanProposal =>
        validatePlanProposal(
          {
            id: randomUUID(),
            ownerId,
            dayPlanId: planId,
            trigger: 'conflict',
            proposedBlocks: blocks,
            tradeoffs: [],
            valid: false,
            validationErrors: [],
            createdAt: now,
          },
          existing,
        );
      const row = (block: PlanBlock) => ({
        id: block.id,
        ownerId: block.ownerId,
        dayPlanId: block.dayPlanId,
        commitmentId: block.commitmentId,
        title: block.title,
        role: block.role,
        anchorClass: block.anchorClass,
        priority: block.priority,
        blockKind: (block.anchorClass === 'hard_external_anchor' ? 'fixed' : 'flexible') as
          'fixed' | 'flexible',
        startAt: block.startAt ? new Date(block.startAt) : null,
        endAt: block.endAt ? new Date(block.endAt) : null,
        earliestStartAt: null,
        latestFinishAt: null,
        estimatedDurationMinutes: block.estimatedDurationMinutes,
        minimumDurationMinutes: block.minimumDurationMinutes,
        completionState: block.completionState,
        reasonForPlacement: block.reasonForPlacement,
        source: block.source,
      });

      try {
        await migrate(database, { migrationsFolder: migrationRoot });
        const migrated = await database.execute<{ count: number }>(
          sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
        );
        expect(migrated.rows[0]?.count).toBeGreaterThanOrEqual(11);
        await database.insert(owners).values({
          id: ownerId,
          emailNormalized: `${ownerId}@synthetic-reliability.test.invalid`,
          displayName: 'Synthetic Reliability Owner',
          timezone: 'UTC',
          isPrimary: false,
        });
        await database.insert(events).values({
          id: eventId,
          ownerId,
          eventType: 'internal.synthetic.reliability.v1',
          source: 'internal',
          idempotencyKey: `synthetic:${eventId}`,
          occurredAt: new Date(now),
          receivedAt: new Date(now),
          payload: { synthetic: true },
          payloadHash: '0'.repeat(64),
          schemaVersion: 1,
          processingStatus: 'processed',
          correlationId,
        });
        expect((await repository.beginOrLoadRequest(request)).duplicate).toBe(false);
        await repository.updateRequestState({
          ownerId,
          requestId,
          state: 'model_requested',
          admission,
        });
        const run: ModelRun = {
          id: randomUUID(),
          ownerId,
          brainRequestId: requestId,
          provider: 'vercel-ai-gateway',
          route: 'standard',
          configuredModelId: 'openai/gpt-6-luna',
          actualModelId: 'openai/gpt-6-luna',
          reasoningEffort: 'medium',
          status: 'completed',
          latencyMs: 1000,
          inputTokens: 4500,
          outputTokens: 1200,
          reasoningTokens: 300,
          cachedInputTokens: 0,
          estimatedCostUsd: 0.0011787012345,
          admission,
          usageAccounting: {
            providerTotalOutputTokens: 1200,
            nonReasoningOutputTokens: 900,
            visibleOutputTokens: null,
            reasoningTokens: 300,
            visibleMeasurement: 'unreported',
            inputBoundExceeded: false,
            outputBoundExceeded: false,
            usageValid: true,
          },
          outputAudit: {
            contractVersion: 'flexible_delta_v2',
            responseTextSha256: 'a'.repeat(64),
            schemaValid: false,
            issuePaths: ['invalid_value:planProposal.proposedBlocks.0.anchorClass'],
            planJson: JSON.stringify({
              proposedBlocks: [{ anchorClass: 'fixed', title: 'Synthetic invalid emission' }],
            }),
            planJsonTruncated: false,
          },
          errorCategory: null,
          createdAt: now,
        };
        // This is synthetic usage, not a billed provider call.
        await repository.persistModelRun(run);
        const [storedRun] = await database.select().from(modelRuns).where(eq(modelRuns.id, run.id));
        expect(storedRun?.admission).toEqual(admission);
        expect(storedRun?.usageAccounting).toEqual(run.usageAccounting);
        expect(storedRun?.outputAudit).toEqual(run.outputAudit);
        expect(storedRun?.exactGatewayCostUsd).toBe('0.0011787012345');
        expect(storedRun?.estimatedCostUsd).toBe('0.00117871');

        const deniedId = randomUUID();
        const deniedAdmission: ModelRequestAdmission = {
          ...admission,
          allowed: false,
          fullRequestInputTokens: 6800,
          measuredInputTokens: 5800,
          reason: 'Synthetic full request exceeds the fixed bound.',
          errorCategory: 'model_input_budget_exceeded',
        };
        await repository.beginOrLoadRequest({
          ...request,
          id: deniedId,
          sourceEventId: null,
          idempotencyKey: `synthetic-denied:${deniedId}`,
        });
        await repository.updateRequestState({
          ownerId,
          requestId: deniedId,
          state: 'failed',
          safeErrorCategory: deniedAdmission.errorCategory,
          completedAt: now,
          admission: deniedAdmission,
        });
        const [denied] = await database
          .select()
          .from(brainRequests)
          .where(eq(brainRequests.id, deniedId));
        expect(denied?.admission).toEqual(deniedAdmission);
        expect(denied?.state).toBe('failed');
        expect(
          await database.select().from(modelRuns).where(eq(modelRuns.brainRequestId, deniedId)),
        ).toHaveLength(0);
        expect((await repository.beginOrLoadRequest(request)).duplicate).toBe(true);

        await database.insert(dayPlans).values({
          id: planId,
          ownerId,
          localDate: '2099-04-07',
          timezone: 'UTC',
          source: 'synthetic_reliability_fixture',
        });
        await database.insert(planBlocks).values(row(canonical));
        const delta = validatePlanProposal(
          { ...proposal([work], [canonical]), contractVersion: 'flexible_delta_v2' },
          [canonical],
        );
        expect(delta.valid).toBe(true);
        expect(delta.preservedBlockIds).toEqual([anchorId]);
        expect(delta.proposedBlocks.map((item) => item.id)).toEqual([workId]);
        const decision: BrainDecision = {
          decisionType: 'replan',
          conversationResponse: {
            message: 'This is a proposed synthetic plan.',
            nextAction: null,
            tone: 'neutral',
          },
          reasoningSummary: {
            decisionSummary: 'Synthetic reliability test.',
            importantEvidenceIds: [],
            materialTradeoffs: [],
            confidenceBasisPoints: 10000,
            missingInformation: [],
          },
          evidence: [],
          clarification: null,
          proposedActions: [],
          memoryCandidates: [],
          planProposal: delta,
          reminderProposal: null,
          interventionProposal: null,
        };
        await repository.persistDecision({
          id: decisionId,
          ownerId,
          brainRequestId: requestId,
          modelRunId: run.id,
          decision,
          promptVersion: 'synthetic-test',
          contextVersion: 'synthetic-test',
          validationState: 'validated',
          executionResult: { state: 'pending' },
          correlationId,
        });
        await repository.persistPlanProposal({
          proposal: delta,
          sourceBrainDecisionId: decisionId,
          correlationId,
        });
        const store = new DrizzleTransactionalEventStore(
          database,
          new CanonicalOnlyDurableJobTransport(),
        );
        const pipeline = {
          store,
          policy: {
            evaluate: (action: ProposedAction) => evaluatePolicy(action, { ownerAuthorized: true }),
          },
        };
        const action = (plan: PlanProposal): ProposedAction => ({
          id: randomUUID(),
          ownerId,
          actionType: 'internal.plan.update',
          payload: { dayPlanId: planId, planProposalId: plan.id },
          riskClass: 'LOW_RISK_INTERNAL',
          idempotencyKey: `synthetic-plan:${plan.id}`,
          sourceBrainDecisionId: decisionId,
          correlationId,
          state: 'proposed',
          expiresAt: null,
        });
        const applyAction = action(delta);
        const first = await processProposedAction(pipeline, {
          action: applyAction,
          source: 'brain',
          reason: 'Synthetic reliability test.',
        });
        expect(first.executed).toBe(true);
        const replay = await processProposedAction(pipeline, {
          action: applyAction,
          source: 'brain',
          reason: 'Synthetic replay.',
        });
        expect(replay.duplicate).toBe(true);
        expect(replay.executed).toBe(false);
        const appliedBlocks = await database
          .select()
          .from(planBlocks)
          .where(eq(planBlocks.dayPlanId, planId));
        expect(appliedBlocks.map((item) => item.id).sort()).toEqual([anchorId, workId].sort());
        expect(appliedBlocks.find((item) => item.id === anchorId)?.source).toBe(
          'synthetic_reliability_fixture',
        );
        expect(appliedBlocks.find((item) => item.id === anchorId)?.startAt?.toISOString()).toBe(
          canonical.startAt,
        );
        const dependencies = await database
          .select()
          .from(planBlockDependencies)
          .where(eq(planBlockDependencies.planBlockId, workId));
        expect(dependencies.map((item) => item.dependsOnPlanBlockId)).toEqual([anchorId]);
        const [appliedPlan] = await database.select().from(dayPlans).where(eq(dayPlans.id, planId));
        expect(appliedPlan?.revision).toBe(2);

        // A proposal is valid against its original snapshot, then another canonical anchor arrives.
        const lateWork = {
          ...work,
          id: randomUUID(),
          startAt: '2099-04-07T18:30:00.000Z',
          endAt: '2099-04-07T19:00:00.000Z',
        };
        const stale = proposal([lateWork], [canonical, work]);
        expect(stale.valid).toBe(true);
        await repository.persistPlanProposal({
          proposal: stale,
          sourceBrainDecisionId: decisionId,
          correlationId,
        });
        const laterAnchor = {
          ...canonical,
          id: randomUUID(),
          title: 'Synthetic later anchor',
          startAt: lateWork.startAt,
          endAt: lateWork.endAt,
          estimatedDurationMinutes: 30,
        };
        await database.insert(planBlocks).values(row(laterAnchor));
        const rejectedAction = action(stale);
        await expect(
          processProposedAction(pipeline, {
            action: rejectedAction,
            source: 'brain',
            reason: 'Synthetic stale apply test.',
          }),
        ).rejects.toThrow(CanonicalPlanValidationError);
        expect(
          await database.select().from(planBlocks).where(eq(planBlocks.id, lateWork.id)),
        ).toHaveLength(0);
        expect(
          await database
            .select()
            .from(proposedActions)
            .where(eq(proposedActions.id, rejectedAction.id)),
        ).toHaveLength(0);
        const [unchangedPlan] = await database
          .select()
          .from(dayPlans)
          .where(eq(dayPlans.id, planId));
        expect(unchangedPlan?.revision).toBe(2);
        const [storedAppliedProposal] = await database
          .select()
          .from(planProposals)
          .where(and(eq(planProposals.id, delta.id), eq(planProposals.ownerId, ownerId)));
        expect(storedAppliedProposal?.state).toBe('applied');
        const canonicalCommitment = {
          id: randomUUID(),
          ownerId,
          title: 'Canonical operation task',
          priority: 80,
          status: 'open' as const,
          flexibility: 'flexible' as const,
          source: 'synthetic_owner',
        };
        await database.insert(commitments).values(canonicalCommitment);
        expect(
          await repository.loadPlanningCommitments({
            ownerId,
            commitmentIds: [canonicalCommitment.id],
          }),
        ).toEqual([canonicalCommitment]);
        expect(
          await repository.loadPlanningCommitments({
            ownerId: randomUUID(),
            commitmentIds: [canonicalCommitment.id],
          }),
        ).toEqual([]);
        const operationBlock = commitmentPlanBlock({
          id: randomUUID(),
          dayPlanId: planId,
          commitment: canonicalCommitment,
          startsAt: '2099-04-07T19:30:00.000Z',
          endsAt: '2099-04-07T20:00:00.000Z',
        });
        const operationDelta: PlanProposal = {
          ...proposal([operationBlock], [canonical, work, laterAnchor]),
          contractVersion: 'flexible_delta_v2',
          commitmentSchedules: [
            { blockId: operationBlock.id, commitmentId: canonicalCommitment.id },
          ],
        };
        await repository.persistPlanProposal({
          proposal: operationDelta,
          sourceBrainDecisionId: decisionId,
          correlationId,
        });
        const operationAction = action(operationDelta);
        const applied = await processProposedAction(pipeline, {
          action: operationAction,
          source: 'brain',
          reason: 'Synthetic canonical operation.',
        });
        expect(applied.executed).toBe(true);
        expect(
          (
            await processProposedAction(pipeline, {
              action: operationAction,
              source: 'brain',
              reason: 'Synthetic replay.',
            })
          ).duplicate,
        ).toBe(true);
        const [scheduled] = await database
          .select()
          .from(planBlocks)
          .where(eq(planBlocks.id, operationBlock.id));
        expect(scheduled).toMatchObject({
          title: canonicalCommitment.title,
          priority: 80,
          commitmentId: canonicalCommitment.id,
          role: 'commitment',
          anchorClass: 'commitment_linked',
        });
        const [savedOperation] = await database
          .select()
          .from(planProposals)
          .where(eq(planProposals.id, operationDelta.id));
        expect(savedOperation?.proposal).toEqual(operationDelta);
        expect(
          await repository.verifyAppliedPlanOperation({ ownerId, proposal: operationDelta }),
        ).toBe(true);
      } finally {
        // Unique synthetic rows intentionally remain in this isolated branch for inspection.
        await runtime.close();
      }
    },
    120_000,
  );
});
