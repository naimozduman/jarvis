import type { PlanBlock, PlanProposal } from './planning.js';

import { hasSamePlanBlockState, isProtectedPlanBlock, normalizePlanDelta } from './plan-delta.js';

/** A deterministic rejection before any plan mutation; distinct from an unknown execution. */
export class CanonicalPlanValidationError extends Error {
  public constructor() {
    super('validation: The plan proposal no longer satisfies canonical plan constraints.');
    this.name = 'CanonicalPlanValidationError';
  }
}

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

/**
 * Pure, deterministic guard in front of persistence. The model can propose a schedule, but a
 * proposal never reaches an apply action until it passes these constraints.
 */
export function validatePlanConstraints(input: PlanValidationInput): PlanValidationResult {
  const errors: string[] = [];
  const existingBlocks = input.existingBlocks.filter(
    (block) => block.ownerId === input.ownerId && block.dayPlanId === input.dayPlanId,
  );
  const existingById = new Map(existingBlocks.map((block) => [block.id, block]));
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
    if (!existingById.has(block.id) && isProtectedPlanBlock(block)) {
      errors.push(
        `New replan block ${block.title} must be flexible; protected anchors are canonical state.`,
      );
    }

    const start = timestamp(block.startAt);
    const end = timestamp(block.endAt);
    const earliest = timestamp(block.earliestStartAt);
    const latest = timestamp(block.latestFinishAt);
    if ((block.startAt === null) !== (block.endAt === null)) {
      errors.push(`Block ${block.title} must have both a start and an end, or neither.`);
    }
    if (isProtectedPlanBlock(block) && (start === null || end === null)) {
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
      if (!proposedById.has(dependencyId) && !existingById.has(dependencyId)) {
        errors.push(`Block ${block.title} references a missing dependency.`);
      }
    }
  }

  const effectiveBlocks = [...input.proposedBlocks];
  for (const existing of existingBlocks) {
    const proposed = proposedById.get(existing.id);
    if (!proposed) {
      // Apply is an upsert-only delta. Every omitted canonical block remains scheduled.
      effectiveBlocks.push(existing);
      continue;
    }
    if (isProtectedPlanBlock(existing) && !hasSamePlanBlockState(proposed, existing)) {
      errors.push(`Protected anchor ${existing.title} cannot be modified by a replan.`);
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
  const scopedExistingBlocks = existingBlocks.filter(
    (block) => block.ownerId === proposal.ownerId && block.dayPlanId === proposal.dayPlanId,
  );
  if (proposal.contractVersion === 'flexible_delta_v2') {
    const isProtected = (block: PlanBlock) =>
      isProtectedPlanBlock(block) || block.role === 'hard_external_anchor';
    const existingById = new Map(scopedExistingBlocks.map((block) => [block.id, block]));
    const protectedMutationErrors = proposal.proposedBlocks.flatMap((block) => {
      const existing = existingById.get(block.id);
      return isProtected(block) || (existing && isProtected(existing))
        ? [
            `Ordinary replan block ${block.id} cannot create, restate, modify or remove a protected anchor; protected mutations are unavailable in this phase.`,
          ]
        : [];
    });
    const validation = validatePlanConstraints({
      ownerId: proposal.ownerId,
      dayPlanId: proposal.dayPlanId,
      existingBlocks,
      proposedBlocks: proposal.proposedBlocks,
    });
    const validationErrors = [...protectedMutationErrors, ...validation.errors];
    return {
      ...proposal,
      // Server projection only. Never merge supplied preservation IDs or infer identity from text/time.
      preservedBlockIds: scopedExistingBlocks.filter(isProtected).map((block) => block.id),
      valid: validationErrors.length === 0,
      validationErrors,
    };
  }
  // Backward compatibility for already persisted unversioned proposals only.
  const delta = normalizePlanDelta({
    existingBlocks: scopedExistingBlocks,
    proposedBlocks: proposal.proposedBlocks,
  });
  const preservedBlockIds = [
    ...new Set([...(proposal.preservedBlockIds ?? []), ...delta.preservedBlockIds]),
  ];
  const preservationErrors = preservedBlockIds
    .filter((id) => !scopedExistingBlocks.some((block) => block.id === id))
    .map((id) => `Preserved block ${id} is unavailable to this owner and day plan.`);
  for (const id of preservedBlockIds) {
    if (delta.proposedBlocks.some((block) => block.id === id)) {
      preservationErrors.push(`Block ${id} cannot be both preserved and modified.`);
    }
  }
  const validation = validatePlanConstraints({
    ownerId: proposal.ownerId,
    dayPlanId: proposal.dayPlanId,
    existingBlocks,
    proposedBlocks: delta.proposedBlocks,
  });
  const validationErrors = [...delta.errors, ...preservationErrors, ...validation.errors];
  return {
    ...proposal,
    proposedBlocks: delta.proposedBlocks,
    preservedBlockIds,
    valid: validationErrors.length === 0,
    validationErrors,
  };
}
