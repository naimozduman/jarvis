import type { BrainDecision } from '@jarvis/contracts';

export interface DecisionExplanation {
  readonly decision: string;
  readonly shortRationale: string;
  readonly importantEvidence: readonly string[];
  readonly tradeoff: string | null;
  readonly nextAction: string | null;
}

/** Produces an auditable user-facing explanation from the persisted safe decision summary only. */
export function explainDecision(decision: BrainDecision): DecisionExplanation {
  return {
    decision: decision.decisionType,
    shortRationale: decision.reasoningSummary.decisionSummary,
    importantEvidence: decision.evidence
      .slice(0, 3)
      .map((evidence) => `${evidence.recordType}:${evidence.recordId}`),
    tradeoff: decision.reasoningSummary.materialTradeoffs[0] ?? null,
    nextAction: decision.conversationResponse?.nextAction ?? null,
  };
}
