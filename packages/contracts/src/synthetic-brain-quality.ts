import { createHash } from 'node:crypto';

/**
 * Fixed, non-personal IDs reserved for the staging Luna quality suite. They intentionally never
 * come from an HTTP request, which keeps the probe from becoming a general context-injection
 * surface. Each is a valid UUID so the normal Brain evidence and proposal contracts apply.
 */
export const syntheticBrainQualityFixtureSource = 'staging_luna_quality_20260929';

/**
 * Frozen text-only owner-chat prompts for the reasoning-effort comparison. They carry no action,
 * web, tool, or research request. The canonical fixture context is supplied server-side only.
 */
export const syntheticCasualChatCaseIds = [
  'greeting',
  'whats_up',
  'tired',
  'remember_earlier',
  'is_this_normal',
  'schedule_today',
  'after_work',
  'report_status',
  'what_else',
  'keep_simple',
  'should_i_stress',
  'quick_check',
  'follow_up_one',
  'follow_up_two',
  'turkish_greeting',
  'mixed_language',
  'uncertainty_check',
  'goodnight',
] as const;

export type SyntheticCasualChatCaseId = (typeof syntheticCasualChatCaseIds)[number];

export function isSyntheticCasualChatCaseId(value: unknown): value is SyntheticCasualChatCaseId {
  return (
    typeof value === 'string' && syntheticCasualChatCaseIds.some((candidate) => candidate === value)
  );
}

export const syntheticBrainQualityCaseIds = [
  'normal_question',
  'reminder_request',
  'plan_change_request',
] as const;

export type SyntheticBrainQualityCaseId = (typeof syntheticBrainQualityCaseIds)[number];

export function isSyntheticBrainQualityCaseId(
  value: unknown,
): value is SyntheticBrainQualityCaseId {
  return (
    typeof value === 'string' &&
    syntheticBrainQualityCaseIds.some((candidate) => candidate === value)
  );
}

export const syntheticBrainQualityFixtureIds = {
  normalSchedule: '8f010000-0000-4000-8000-000000000101',
  normalDeadline: '8f010000-0000-4000-8000-000000000102',
  normalDayPlan: '8f010000-0000-4000-8000-000000000103',
  reminderCommitment: '8f010000-0000-4000-8000-000000000201',
  planCommitment: '8f010000-0000-4000-8000-000000000301',
  planDayPlan: '8f010000-0000-4000-8000-000000000302',
  planHardAnchor: '8f010000-0000-4000-8000-000000000303',
} as const;

/**
 * Production smoke is intentionally separate from the historical staging quality suite. A run
 * carries only a UUID selector; every owner and fixture identifier is derived server-side.
 */
export const productionSmokeFixtureSource = 'production_smoke_20260929';

export const productionSmokeCaseIds = [
  'grounded_context_question',
  'reminder_behavior',
  'case3_plan_application',
  'protected_anchor_overlap_rejection',
  'simulated_provider_failure',
] as const;

export type ProductionSmokeCaseId = (typeof productionSmokeCaseIds)[number];

export function isProductionSmokeCaseId(value: unknown): value is ProductionSmokeCaseId {
  return (
    typeof value === 'string' && productionSmokeCaseIds.some((candidate) => candidate === value)
  );
}

export function isProductionSmokeRunId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function deterministicUuid(seed: string): string {
  const digest = createHash('sha256').update(seed, 'utf8').digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

/**
 * The only production-smoke identifiers accepted by the server. They are deterministic so a
 * replay reaches the same isolated owner/scope and cleanup can never infer a broader target.
 */
export function productionSmokeFixtureIds(runId: string) {
  const id = (name: string) =>
    deterministicUuid(`${productionSmokeFixtureSource}:${runId}:${name}`);
  return {
    owner: id('owner'),
    normalSchedule: id('normal-schedule'),
    normalDeadline: id('normal-deadline'),
    normalDayPlan: id('normal-day-plan'),
    reminderCommitment: id('reminder-commitment'),
    planCommitment: id('plan-commitment'),
    planDayPlan: id('plan-day-plan'),
    planHardAnchor: id('plan-hard-anchor'),
  } as const;
}
