import type { PlanBlock, PlanProposal } from '@jarvis/contracts';

import { validatePlanProposal } from './constraint-validator.js';

export interface ReplanOption {
  readonly proposal: PlanProposal;
  readonly valid: boolean;
  readonly explanation: string;
}

export interface ReplanEvaluationInput {
  readonly existingBlocks: readonly PlanBlock[];
  readonly candidateProposals: readonly PlanProposal[];
  readonly hardOverrideActive: boolean;
}

/**
 * Deterministically filters model-assisted options. An explicit hard override can favour a valid
 * flexible option, but it cannot permit a collision with a fixed external anchor.
 */
export class ReplanningEngine {
  public evaluate(input: ReplanEvaluationInput): readonly ReplanOption[] {
    return input.candidateProposals.map((candidate) => {
      const proposal = validatePlanProposal(candidate, input.existingBlocks);
      const explanation = proposal.valid
        ? input.hardOverrideActive
          ? 'Valid option that preserves protected anchors while respecting the explicit owner override.'
          : 'Valid option that preserves protected anchors and stated constraints.'
        : `Rejected by deterministic constraints: ${proposal.validationErrors.join(' ')}`;
      return { proposal, valid: proposal.valid, explanation };
    });
  }

  public selectPreferredValidOption(options: readonly ReplanOption[]): ReplanOption | undefined {
    return options
      .filter((option) => option.valid)
      .sort(
        (left, right) =>
          right.proposal.proposedBlocks.reduce((sum, block) => sum + block.priority, 0) -
            left.proposal.proposedBlocks.reduce((sum, block) => sum + block.priority, 0) ||
          left.proposal.id.localeCompare(right.proposal.id),
      )[0];
  }
}
