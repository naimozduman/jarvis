import type { PlanBlock, PlanProposal } from '@jarvis/contracts';

export interface PlanValidationInput {
  readonly ownerId: string;
  readonly dayPlanId: string;
  readonly existingBlocks: readonly PlanBlock[];
  readonly proposedBlocks: readonly PlanBlock[];
}

export interface PlanValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function timestamp(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function overlaps(left: PlanBlock, right: PlanBlock): boolean {
  const leftStart = timestamp(left.startAt);
  const leftEnd = timestamp(left.endAt);
  const rightStart = timestamp(right.startAt);
  const rightEnd = timestamp(right.endAt);
  return leftStart !== null && leftEnd !== null && rightStart !== null && rightEnd !== null
    ? leftStart < rightEnd && rightStart < leftEnd
    : false;
}

function anchorIsProtected(block: PlanBlock): boolean {
  return block.anchorClass === 'hard_external_anchor' || block.anchorClass === 'fixed';
}

/**
 * Pure, deterministic guard in front of persistence. The model can propose a schedule, but a
 * proposal never reaches an apply action until it passes these constraints.
 */
export function validatePlanConstraints(input: PlanValidationInput): PlanValidationResult {
  const errors: string[] = [];
  const proposedById = new Map(input.proposedBlocks.map((block) => [block.id, block]));
  const ids = new Set<string>();

  for (const block of input.proposedBlocks) {
    if (block.ownerId !== input.ownerId || block.dayPlanId !== input.dayPlanId) {
      errors.push(`Block ${block.id} is not scoped to this owner and day plan.`);
    }
    if (ids.has(block.id)) {
      errors.push(`Block ${block.id} appears more than once.`);
    }
    ids.add(block.id);

    const start = timestamp(block.startAt);
    const end = timestamp(block.endAt);
    const earliest = timestamp(block.earliestStartAt);
    const latest = timestamp(block.latestFinishAt);
    if ((block.startAt === null) !== (block.endAt === null)) {
      errors.push(`Block ${block.title} must have both a start and an end, or neither.`);
    }
    if (anchorIsProtected(block) && (start === null || end === null)) {
      errors.push(`Protected block ${block.title} must retain a concrete time window.`);
    }
    if (start !== null && end !== null && start >= end) {
      errors.push(`Block ${block.title} must end after it starts.`);
    }
    if (start !== null && earliest !== null && start < earliest) {
      errors.push(`Block ${block.title} starts before its earliest permitted time.`);
    }
    if (end !== null && latest !== null && end > latest) {
      errors.push(`Block ${block.title} ends after its latest permitted time.`);
    }
    if (
      block.minimumDurationMinutes !== null &&
      block.minimumDurationMinutes > block.estimatedDurationMinutes
    ) {
      errors.push(`Block ${block.title} has a minimum duration longer than its estimate.`);
    }
    for (const dependencyId of block.dependencyIds) {
      if (!proposedById.has(dependencyId)) {
        errors.push(`Block ${block.title} references a missing dependency.`);
      }
    }
  }

  const effectiveBlocks = [...input.proposedBlocks];
  for (const hardAnchor of input.existingBlocks.filter(anchorIsProtected)) {
    const proposed = proposedById.get(hardAnchor.id);
    if (!proposed) {
      // Omission means retain the existing protected anchor. It cannot be silently deleted.
      effectiveBlocks.push(hardAnchor);
      continue;
    }
    if (proposed.startAt !== hardAnchor.startAt || proposed.endAt !== hardAnchor.endAt) {
      errors.push(`Protected anchor ${hardAnchor.title} cannot be moved by a replan.`);
    }
  }

  for (let leftIndex = 0; leftIndex < effectiveBlocks.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < effectiveBlocks.length; rightIndex += 1) {
      const left = effectiveBlocks[leftIndex];
      const right = effectiveBlocks[rightIndex];
      if (!left || !right) {
        continue;
      }
      if (overlaps(left, right)) {
        errors.push(`Scheduled blocks ${left.title} and ${right.title} overlap.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validatePlanProposal(
  proposal: PlanProposal,
  existingBlocks: readonly PlanBlock[],
): PlanProposal {
  const validation = validatePlanConstraints({
    ownerId: proposal.ownerId,
    dayPlanId: proposal.dayPlanId,
    existingBlocks,
    proposedBlocks: proposal.proposedBlocks,
  });
  return { ...proposal, valid: validation.valid, validationErrors: [...validation.errors] };
}
