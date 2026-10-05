import { describe, expect, it } from 'vitest';

import { validatePlanProposal } from '@jarvis/brain';
import type { PlanProposal, ProposedAction } from '@jarvis/contracts';
import {
  productionSmokeFixtureIds,
  syntheticBrainQualityFixtureIds,
  syntheticCasualChatCaseIds,
} from '@jarvis/contracts';
import {
  createSyntheticQualityPolicyEvaluator,
  productionSmokeCase,
  syntheticCasualChatCase,
  syntheticBrainQualityCase,
} from '@jarvis/orchestration';

const ownerId = '00000000-0000-4000-8000-000000000001';

describe('fixed staging Luna quality cases', () => {
  it('freezes an ordinary text-only benchmark suite over one isolated canonical context', () => {
    const runId = '30303030-3030-4030-8030-303030303030';
    expect(syntheticCasualChatCaseIds).toHaveLength(18);
    const cases = syntheticCasualChatCaseIds.map((caseId) =>
      syntheticCasualChatCase({
        runId,
        caseId,
        ownerId: productionSmokeFixtureIds(runId).owner,
      }),
    );
    expect(cases.every((item) => item.purpose === 'conversation')).toBe(true);
    expect(cases.map((item) => item.message)).toContain('Hey Jarvis');
    expect(cases.map((item) => item.message)).toContain('bro bugün ne var, keep it short');
    expect(new Set(cases.map((item) => JSON.stringify(item.currentState))).size).toBe(1);
  });

  it('uses fixed non-personal context and preserves the supplied uncertainty boundary', () => {
    const testCase = syntheticBrainQualityCase({ caseId: 'normal_question', ownerId });

    expect(testCase.purpose).toBe('conversation');
    expect(testCase.message).toContain('explicitly distinguish unavailable schedule information');
    expect(testCase.currentState.contextRecords.map((record) => record.recordId)).toEqual([
      syntheticBrainQualityFixtureIds.normalSchedule,
      syntheticBrainQualityFixtureIds.normalDeadline,
    ]);
    expect(testCase.currentState.contextRecords[0]?.content).toContain(
      'No other schedule data is available.',
    );
    expect(testCase.currentState.contextRecords[1]?.content).toContain(
      'There is no completion evidence.',
    );
  });

  it('provides only the known replan window while the deterministic validator retains the hard anchor', () => {
    const testCase = syntheticBrainQualityCase({ caseId: 'plan_change_request', ownerId });
    const proposal: PlanProposal = {
      id: '00000000-0000-4000-8000-000000000401',
      ownerId,
      dayPlanId: syntheticBrainQualityFixtureIds.planDayPlan,
      trigger: 'missed_commitment',
      proposedBlocks: [
        {
          id: '00000000-0000-4000-8000-000000000402',
          ownerId,
          dayPlanId: syntheticBrainQualityFixtureIds.planDayPlan,
          commitmentId: syntheticBrainQualityFixtureIds.planCommitment,
          title: 'Finish synthetic admin task — minimum viable version',
          role: 'commitment',
          anchorClass: 'commitment_linked',
          priority: 80,
          startAt: '2099-04-07T17:30:00.000Z',
          endAt: '2099-04-07T18:00:00.000Z',
          earliestStartAt: '2099-04-07T17:30:00.000Z',
          latestFinishAt: '2099-04-07T19:00:00.000Z',
          estimatedDurationMinutes: 30,
          minimumDurationMinutes: 30,
          dependencyIds: [],
          completionState: 'planned',
          reasonForPlacement: 'The supplied window is the only known availability.',
          source: 'synthetic_test',
        },
      ],
      tradeoffs: ['The task is reduced to its stated 30-minute minimum viable version.'],
      valid: false,
      validationErrors: [],
      createdAt: '2099-04-01T00:00:00.000Z',
    };

    const validated = validatePlanProposal(proposal, testCase.currentState.existingPlanBlocks);

    expect(validated.valid).toBe(true);
    expect(validated.validationErrors).toEqual([]);
    expect(testCase.currentState.existingPlanBlocks[0]).toMatchObject({
      id: syntheticBrainQualityFixtureIds.planHardAnchor,
      startAt: '2099-04-07T16:00:00.000Z',
      endAt: '2099-04-07T17:00:00.000Z',
    });
  });

  it('retains non-plan internal actions behind a recorded approval boundary', () => {
    const action: ProposedAction = {
      id: '00000000-0000-4000-8000-000000000501',
      ownerId,
      actionType: 'internal.reminder.create',
      payload: {
        reminderId: '00000000-0000-4000-8000-000000000502',
        title: 'Call synthetic pharmacy',
        nextEligibleDeliveryAt: '2099-04-06T16:30:00.000Z',
      },
      riskClass: 'LOW_RISK_INTERNAL',
      idempotencyKey: 'synthetic-quality-policy-test-0001',
      correlationId: '00000000-0000-4000-8000-000000000503',
      state: 'proposed',
      expiresAt: null,
    };

    const evaluation = createSyntheticQualityPolicyEvaluator().evaluate(action);

    expect(evaluation).toMatchObject({ allowed: false, requiresApproval: true, denied: false });
    expect(evaluation.matchedRules).toContain('staging-quality.execution-inhibited');
  });

  it('preserves the canonical policy result for the server-materialized synthetic plan action', () => {
    const action: ProposedAction = {
      id: '00000000-0000-4000-8000-000000000511',
      ownerId,
      actionType: 'internal.plan.update',
      payload: { dayPlanId: syntheticBrainQualityFixtureIds.planDayPlan },
      riskClass: 'LOW_RISK_INTERNAL',
      idempotencyKey: 'synthetic-quality-plan-policy-test-0001',
      correlationId: '00000000-0000-4000-8000-000000000512',
      state: 'proposed',
      expiresAt: null,
    };

    const evaluation = createSyntheticQualityPolicyEvaluator().evaluate(action);

    expect(evaluation).toMatchObject({ allowed: true, requiresApproval: false, denied: false });
    expect(evaluation.matchedRules).not.toContain('staging-quality.execution-inhibited');
  });

  it('derives a distinct synthetic scope per smoke run without accepting an owner or fixture override', () => {
    const firstRun = '10101010-1010-4010-8010-101010101010';
    const secondRun = '20202020-2020-4020-8020-202020202020';
    const first = productionSmokeCase({
      runId: firstRun,
      caseId: 'case3_plan_application',
      ownerId: productionSmokeFixtureIds(firstRun).owner,
    });
    const second = productionSmokeCase({
      runId: secondRun,
      caseId: 'case3_plan_application',
      ownerId: productionSmokeFixtureIds(secondRun).owner,
    });

    expect(first.currentState.availableDayPlanIds).toEqual([
      productionSmokeFixtureIds(firstRun).planDayPlan,
    ]);
    expect(first.currentState.availableDayPlanIds).not.toEqual(
      second.currentState.availableDayPlanIds,
    );
    expect(first.currentState.existingPlanBlocks[0]?.ownerId).not.toBe(ownerId);
    expect(first.currentState.existingPlanBlocks[0]?.id).toBe(
      productionSmokeFixtureIds(firstRun).planHardAnchor,
    );
  });
});
