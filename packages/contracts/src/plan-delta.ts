import type { PlanBlock } from './planning.js';

export function isProtectedPlanBlock(block: PlanBlock): boolean {
  return (
    block.anchorClass === 'hard_external_anchor' ||
    block.anchorClass === 'fixed' ||
    block.role === 'hard_external_anchor'
  );
}

/** Placement explanations and provenance cannot change the identity or semantics of a block. */
export function hasSamePlanBlockState(left: PlanBlock, right: PlanBlock): boolean {
  const timestamps = (block: PlanBlock) => [
    block.startAt,
    block.endAt,
    block.earliestStartAt,
    block.latestFinishAt,
  ];
  if (
    [...timestamps(left), ...timestamps(right)].some(
      (value) => value !== null && !Number.isFinite(Date.parse(value)),
    )
  ) {
    return false;
  }
  const instant = (value: string | null) => (value === null ? null : Date.parse(value));
  const state = (block: PlanBlock) => ({
    ownerId: block.ownerId,
    dayPlanId: block.dayPlanId,
    commitmentId: block.commitmentId,
    title: block.title,
    role: block.role,
    anchorClass: block.anchorClass,
    priority: block.priority,
    startAt: instant(block.startAt),
    endAt: instant(block.endAt),
    earliestStartAt: instant(block.earliestStartAt),
    latestFinishAt: instant(block.latestFinishAt),
    estimatedDurationMinutes: block.estimatedDurationMinutes,
    minimumDurationMinutes: block.minimumDurationMinutes,
    dependencyIds: [...block.dependencyIds].sort(),
    completionState: block.completionState,
  });
  return JSON.stringify(state(left)) === JSON.stringify(state(right));
}

/**
 * The server preserves every protected anchor independently of model output. An unreferenced block is
 * recognized only if every canonical state field matches exactly one existing protected block.
 * Similar titles, coincident times, or ambiguous matches are deliberately not identity evidence.
 */
export function normalizePlanDelta(input: {
  readonly existingBlocks: readonly PlanBlock[];
  readonly proposedBlocks: readonly PlanBlock[];
}): {
  readonly proposedBlocks: PlanBlock[];
  readonly preservedBlockIds: string[];
  readonly errors: string[];
} {
  const byId = new Map(input.existingBlocks.map((block) => [block.id, block]));
  const proposedBlocks: PlanBlock[] = [];
  const preservedBlockIds = input.existingBlocks
    .filter(isProtectedPlanBlock)
    .map((block) => block.id);
  const explicitPreservations = new Set<string>();
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const block of input.proposedBlocks) {
    if (seen.has(block.id)) {
      errors.push(`Block ${block.id} appears more than once.`);
    }
    seen.add(block.id);
    const existing = byId.get(block.id);
    const matches = existing
      ? [existing]
      : isProtectedPlanBlock(block)
        ? input.existingBlocks.filter(
            (candidate) =>
              isProtectedPlanBlock(candidate) && hasSamePlanBlockState(block, candidate),
          )
        : [];
    const preserved = matches.length === 1 ? matches[0] : undefined;
    if (preserved && hasSamePlanBlockState(block, preserved)) {
      if (explicitPreservations.has(preserved.id)) {
        errors.push(`Canonical block ${preserved.id} was referenced more than once.`);
      } else {
        explicitPreservations.add(preserved.id);
        if (!preservedBlockIds.includes(preserved.id)) preservedBlockIds.push(preserved.id);
      }
    } else {
      if (!existing && isProtectedPlanBlock(block)) {
        errors.push(
          matches.length > 1
            ? `Protected anchor ${block.title} has ambiguous canonical identity.`
            : `Protected anchor ${block.title} differs from canonical state or has no safe identity; explicit existingBlockId and authority are required.`,
        );
      }
      proposedBlocks.push(block);
    }
  }
  return { proposedBlocks, preservedBlockIds, errors };
}
