import type { ConversationCurrentState } from '@jarvis/brain';
import type {
  ContextRecord,
  PlanBlock,
  ProductionSmokeCaseId,
  SyntheticCasualChatCaseId,
  SyntheticBrainQualityCaseId,
} from '@jarvis/contracts';
import {
  productionSmokeFixtureIds,
  productionSmokeFixtureSource,
  syntheticBrainQualityFixtureIds,
  syntheticBrainQualityFixtureSource,
} from '@jarvis/contracts';

export interface SyntheticBrainQualityCase {
  readonly caseId: string;
  readonly message: string;
  readonly purpose: 'conversation' | 'reminder' | 'replan';
  readonly currentState: ConversationCurrentState;
}

const casualChatMessages: Readonly<Record<SyntheticCasualChatCaseId, string>> = {
  greeting: 'Hey Jarvis',
  whats_up: "what's up",
  tired: "bro I'm tired",
  remember_earlier: 'what did I tell you earlier?',
  is_this_normal: 'is this normal',
  schedule_today: 'what do I have today?',
  after_work: 'do I have anything after work?',
  report_status: 'where am I with that report?',
  what_else: 'okay, what else should I know?',
  keep_simple: 'keep it simple',
  should_i_stress: 'should I stress about this?',
  quick_check: 'quick check, am I missing anything?',
  follow_up_one: 'and after that?',
  follow_up_two: 'got it, anything important?',
  turkish_greeting: 'Selam Jarvis, ne var?',
  mixed_language: 'bro bugün ne var, keep it short',
  uncertainty_check: 'do you actually know that or are you guessing?',
  goodnight: 'alright, goodnight',
};

/** Text-only benchmark case with fixed synthetic context, no mutation request, and no tools. */
export function syntheticCasualChatCase(input: {
  readonly runId: string;
  readonly caseId: SyntheticCasualChatCaseId;
  readonly ownerId: string;
}): SyntheticBrainQualityCase {
  const baseline = productionSmokeCase({
    runId: input.runId,
    caseId: 'grounded_context_question',
    ownerId: input.ownerId,
  });
  return {
    ...baseline,
    caseId: input.caseId,
    purpose: 'conversation',
    message: casualChatMessages[input.caseId],
  };
}

interface FixtureIds {
  readonly normalSchedule: string;
  readonly normalDeadline: string;
  readonly normalDayPlan: string;
  readonly reminderCommitment: string;
  readonly planCommitment: string;
  readonly planDayPlan: string;
  readonly planHardAnchor: string;
}

function record(input: Omit<ContextRecord, 'ownerId'>, ownerId: string): ContextRecord {
  return { ...input, ownerId };
}

function baseState(input: {
  readonly contextRecords: readonly ContextRecord[];
  readonly availableData: ConversationCurrentState['availableData'];
  readonly existingPlanBlocks?: readonly PlanBlock[];
  readonly availableDayPlanIds?: readonly string[];
}): ConversationCurrentState {
  return {
    contextRecords: input.contextRecords,
    hardOverrideIds: [],
    availableData: input.availableData,
    existingPlanBlocks: input.existingPlanBlocks ?? [],
    availableDayPlanIds: input.availableDayPlanIds ?? [],
    hasConflict: false,
    highConsequence: false,
    // The normal model router sees a standard route from the request purpose; a test case never
    // advertises an available deep escalation path.
    remainingDeepCalls: 0,
    maximumModelCalls: 1,
    callsAlreadyMade: 0,
    dailyModelSpendEstimateUsd: 0,
    dailyDeepCallsUsed: 0,
  };
}

function normalQuestionCase(
  ownerId: string,
  ids: FixtureIds,
  source: string,
  caseId: string,
): SyntheticBrainQualityCase {
  return {
    caseId,
    purpose: 'conversation',
    message:
      'Within this synthetic-only scenario, what do I have on 2099-04-06? State the known fixed work block, explicitly distinguish unavailable schedule information, and do not say that the report is complete.',
    currentState: baseState({
      availableData: [{ domain: 'schedule', state: 'known' }],
      contextRecords: [
        record(
          {
            recordId: ids.normalSchedule,
            recordType: 'schedule_block',
            source,
            informationState: 'known',
            confidenceBasisPoints: 10_000,
            sensitivity: 'normal',
            observedAt: '2099-04-01T00:00:00.000Z',
            content:
              'SYNTHETIC QUALITY FIXTURE ONLY. On 2099-04-06, the known fixed work block is 09:00–17:00 UTC. No other schedule data is available.',
            entityReferences: [],
            constitutionalRelevance: 0,
            activeCommitmentRelevance: 20,
            deadlineProximityMinutes: null,
            currentDayRelevance: 100,
            sourceAuthority: 100,
          },
          ownerId,
        ),
        record(
          {
            recordId: ids.normalDeadline,
            recordType: 'commitment',
            source,
            informationState: 'known',
            confidenceBasisPoints: 10_000,
            sensitivity: 'normal',
            observedAt: '2099-04-01T00:00:00.000Z',
            content:
              'SYNTHETIC QUALITY FIXTURE ONLY. The open commitment "submit synthetic report" is due 2099-04-08T17:00:00.000Z. There is no completion evidence.',
            entityReferences: [],
            constitutionalRelevance: 0,
            activeCommitmentRelevance: 60,
            deadlineProximityMinutes: null,
            currentDayRelevance: 20,
            sourceAuthority: 100,
          },
          ownerId,
        ),
      ],
    }),
  };
}

function reminderRequestCase(
  ownerId: string,
  ids: FixtureIds,
  source: string,
  caseId: string,
): SyntheticBrainQualityCase {
  return {
    caseId,
    purpose: 'reminder',
    message:
      'Please remind me to call the synthetic pharmacy at 16:30 UTC on 2099-04-06. Make the normal structured reminder proposal from the supplied open commitment; do not claim it is complete or send anything.',
    currentState: baseState({
      availableData: [{ domain: 'commitments', state: 'known' }],
      contextRecords: [
        record(
          {
            recordId: ids.reminderCommitment,
            recordType: 'commitment',
            source,
            informationState: 'known',
            confidenceBasisPoints: 10_000,
            sensitivity: 'normal',
            observedAt: '2099-04-01T00:00:00.000Z',
            content:
              'SYNTHETIC QUALITY FIXTURE ONLY. Open commitment: "call synthetic pharmacy" before 2099-04-06T17:00:00.000Z. No completion evidence exists.',
            entityReferences: [],
            constitutionalRelevance: 0,
            activeCommitmentRelevance: 100,
            deadlineProximityMinutes: null,
            currentDayRelevance: 100,
            sourceAuthority: 100,
          },
          ownerId,
        ),
      ],
    }),
  };
}

function planChangeCase(
  ownerId: string,
  ids: FixtureIds,
  source: string,
  caseId: string,
  overlap: boolean = false,
): SyntheticBrainQualityCase {
  const hardAnchor: PlanBlock = {
    id: ids.planHardAnchor,
    ownerId,
    dayPlanId: ids.planDayPlan,
    commitmentId: null,
    title: 'Synthetic fixed external appointment',
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
    reasonForPlacement: 'Fixed synthetic fixture constraint.',
    source,
  };
  return {
    caseId,
    purpose: 'replan',
    message: overlap
      ? 'The synthetic admin task must be placed from 16:30–17:00 UTC despite the fixed appointment. Make the normal structured replan proposal and do not claim it was applied.'
      : 'The synthetic admin task was missed. Put its 30-minute minimum viable version into the known 17:30–19:00 UTC window, preserve the 16:00–17:00 fixed appointment, and do not mark the commitment complete.',
    currentState: baseState({
      availableData: [
        { domain: 'planning', state: 'known' },
        { domain: 'commitments', state: 'known' },
      ],
      existingPlanBlocks: [hardAnchor],
      availableDayPlanIds: [ids.planDayPlan],
      contextRecords: [
        record(
          {
            recordId: ids.planCommitment,
            recordType: 'commitment',
            source,
            informationState: 'known',
            confidenceBasisPoints: 10_000,
            sensitivity: 'normal',
            observedAt: '2099-04-01T00:00:00.000Z',
            content:
              'SYNTHETIC QUALITY FIXTURE ONLY. Open commitment "finish synthetic admin task" was missed earlier today. Its minimum viable version is 30 minutes. No completion evidence exists.',
            entityReferences: [],
            constitutionalRelevance: 0,
            activeCommitmentRelevance: 100,
            deadlineProximityMinutes: null,
            currentDayRelevance: 100,
            sourceAuthority: 100,
          },
          ownerId,
        ),
        record(
          {
            recordId: ids.planDayPlan,
            recordType: 'day_plan',
            source,
            informationState: 'known',
            confidenceBasisPoints: 10_000,
            sensitivity: 'normal',
            observedAt: '2099-04-01T00:00:00.000Z',
            content: `SYNTHETIC QUALITY FIXTURE ONLY. Active day plan ID is ${ids.planDayPlan}. The fixed external appointment is 2099-04-07T16:00:00.000Z to 2099-04-07T17:00:00.000Z. The only known available window is 2099-04-07T17:30:00.000Z to 2099-04-07T19:00:00.000Z. No availability outside that window is supplied.`,
            entityReferences: [ids.planDayPlan, ids.planHardAnchor],
            constitutionalRelevance: 0,
            activeCommitmentRelevance: 80,
            deadlineProximityMinutes: null,
            currentDayRelevance: 100,
            sourceAuthority: 100,
          },
          ownerId,
        ),
      ],
    }),
  };
}

/** Returns the full, fixed case input. No caller-supplied context, action, or provider data enters it. */
export function syntheticBrainQualityCase(input: {
  readonly caseId: SyntheticBrainQualityCaseId;
  readonly ownerId: string;
}): SyntheticBrainQualityCase {
  switch (input.caseId) {
    case 'normal_question':
      return normalQuestionCase(
        input.ownerId,
        syntheticBrainQualityFixtureIds,
        syntheticBrainQualityFixtureSource,
        input.caseId,
      );
    case 'reminder_request':
      return reminderRequestCase(
        input.ownerId,
        syntheticBrainQualityFixtureIds,
        syntheticBrainQualityFixtureSource,
        input.caseId,
      );
    case 'plan_change_request':
      return planChangeCase(
        input.ownerId,
        syntheticBrainQualityFixtureIds,
        syntheticBrainQualityFixtureSource,
        input.caseId,
      );
  }
}

/** Fixed production-smoke input. The UUID run determines every canonical reference. */
export function productionSmokeCase(input: {
  readonly runId: string;
  readonly caseId: ProductionSmokeCaseId;
  readonly ownerId: string;
}): SyntheticBrainQualityCase {
  const ids = productionSmokeFixtureIds(input.runId);
  switch (input.caseId) {
    case 'grounded_context_question':
      return normalQuestionCase(input.ownerId, ids, productionSmokeFixtureSource, input.caseId);
    case 'reminder_behavior':
      return reminderRequestCase(input.ownerId, ids, productionSmokeFixtureSource, input.caseId);
    case 'case3_plan_application':
      return planChangeCase(input.ownerId, ids, productionSmokeFixtureSource, input.caseId);
    case 'protected_anchor_overlap_rejection':
      return planChangeCase(input.ownerId, ids, productionSmokeFixtureSource, input.caseId, true);
    case 'simulated_provider_failure':
      return planChangeCase(input.ownerId, ids, productionSmokeFixtureSource, input.caseId);
  }
}
