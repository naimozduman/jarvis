import type { MemoryAuthority, MemoryCandidate, MemoryCandidateKind } from '@jarvis/contracts';

export interface MemoryPromotionRuleResult {
  readonly effectiveKind: MemoryCandidateKind;
  readonly requiresOwnerConfirmation: boolean;
  readonly mayBecomeDurableRecord: boolean;
  readonly reason: string;
}

/**
 * Centralized epistemic rules. Importantly, this function never upgrades a model hypothesis or an
 * observation into a fact, regardless of its confidence score or how often it is retrieved.
 */
export function evaluateMemoryPromotion(
  candidate: Pick<
    MemoryCandidate,
    'kind' | 'authority' | 'evidenceIds' | 'requiresOwnerConfirmation'
  >,
): MemoryPromotionRuleResult {
  const evidenceCount = candidate.evidenceIds.length;
  if (candidate.kind === 'constitution_candidate') {
    return {
      effectiveKind: 'constitution_candidate',
      requiresOwnerConfirmation: true,
      mayBecomeDurableRecord: false,
      reason: 'A model constitution candidate is a draft proposal and can never activate itself.',
    };
  }
  if (candidate.authority === 'model_inference' || candidate.kind === 'hypothesis') {
    return {
      effectiveKind: 'hypothesis',
      requiresOwnerConfirmation: true,
      mayBecomeDurableRecord: false,
      reason: 'Model inference remains a hypothesis until explicit owner confirmation.',
    };
  }
  if (candidate.kind === 'observation') {
    return {
      effectiveKind: 'observation',
      requiresOwnerConfirmation: candidate.requiresOwnerConfirmation,
      mayBecomeDurableRecord: candidate.authority !== 'untrusted_external_content',
      reason: 'Observed behavior remains an observation and cannot rewrite a fact or constitution.',
    };
  }
  if (
    candidate.kind === 'preference' &&
    evidenceCount < 3 &&
    candidate.authority !== 'owner_review'
  ) {
    return {
      effectiveKind: 'preference',
      requiresOwnerConfirmation: true,
      mayBecomeDurableRecord: false,
      reason: 'A preference needs repeated evidence or explicit owner review before durable use.',
    };
  }
  if (candidate.authority === 'untrusted_external_content') {
    return {
      effectiveKind: candidate.kind,
      requiresOwnerConfirmation: true,
      mayBecomeDurableRecord: false,
      reason: 'Untrusted external content cannot directly create durable owner memory.',
    };
  }
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
  switch (authority) {
    case 'owner_review':
      return 10_000;
    case 'explicit_owner_statement':
      return 9_000;
    case 'trusted_source':
      return 7_000;
    case 'repeated_observation':
      return 5_000;
    case 'single_observation':
      return 2_500;
    case 'model_inference':
      return 1_000;
    case 'untrusted_external_content':
      return 0;
  }
}
