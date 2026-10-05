import type { MemoryAuthority, MemoryCandidate, MemoryCandidateKind } from './memory.js';

export interface MemoryPromotionRuleResult {
  readonly effectiveKind: MemoryCandidateKind;
  readonly requiresOwnerConfirmation: boolean;
  readonly mayBecomeDurableRecord: boolean;
  readonly reason: string;
}

/** Shared by Brain candidate admission and canonical owner-reviewed promotion. */
export function evaluateMemoryPromotion(
  candidate: Pick<
    MemoryCandidate,
    'kind' | 'authority' | 'evidenceIds' | 'requiresOwnerConfirmation'
  >,
): MemoryPromotionRuleResult {
  if (candidate.kind === 'constitution_candidate')
    return {
      effectiveKind: 'constitution_candidate',
      requiresOwnerConfirmation: true,
      mayBecomeDurableRecord: false,
      reason: 'A model constitution candidate is a draft proposal and can never activate itself.',
    };
  if (candidate.authority === 'model_inference' || candidate.kind === 'hypothesis')
    return {
      effectiveKind: 'hypothesis',
      requiresOwnerConfirmation: true,
      mayBecomeDurableRecord: false,
      reason: 'Model inference remains a hypothesis until explicit owner confirmation.',
    };
  if (candidate.kind === 'observation')
    return {
      effectiveKind: 'observation',
      requiresOwnerConfirmation: candidate.requiresOwnerConfirmation,
      mayBecomeDurableRecord: candidate.authority !== 'untrusted_external_content',
      reason: 'Observed behavior remains an observation and cannot rewrite a fact or constitution.',
    };
  if (
    candidate.kind === 'preference' &&
    candidate.evidenceIds.length < 3 &&
    candidate.authority !== 'owner_review'
  )
    return {
      effectiveKind: 'preference',
      requiresOwnerConfirmation: true,
      mayBecomeDurableRecord: false,
      reason: 'A preference needs repeated evidence or explicit owner review before durable use.',
    };
  if (candidate.authority === 'untrusted_external_content')
    return {
      effectiveKind: candidate.kind,
      requiresOwnerConfirmation: true,
      mayBecomeDurableRecord: false,
      reason: 'Untrusted external content cannot directly create durable owner memory.',
    };
  return {
    effectiveKind: candidate.kind,
    requiresOwnerConfirmation: candidate.requiresOwnerConfirmation,
    mayBecomeDurableRecord: !candidate.requiresOwnerConfirmation,
    reason:
      candidate.authority === 'explicit_owner_statement'
        ? 'Explicit owner statement may become a reviewed durable record.'
        : 'Candidate requires the normal review workflow.',
  };
}

export function authorityWeight(authority: MemoryAuthority): number {
  return (
    {
      owner_review: 10_000,
      explicit_owner_statement: 9_000,
      trusted_source: 7_000,
      repeated_observation: 5_000,
      single_observation: 2_500,
      model_inference: 1_000,
      untrusted_external_content: 0,
    } as const
  )[authority];
}
