import { describe, expect, it } from 'vitest';

import type { PlanBlock, PlanProposal, ProposedAction } from '@jarvis/contracts';
import {
  CanonicalPlanValidationError,
  validatePlanProposal,
  commitmentPlanBlock,
} from '@jarvis/contracts';

import type { JarvisDatabase } from '../src/client.js';
import { DrizzleTransactionalEventStore } from '../src/event-store.js';
import type { TransactionalJobTransport } from '../src/jobs.js';
import {
  dayPlans,
  planBlocks,
  planBlockDependencies,
  planProposals,
  commitments,
} from '../src/schema/index.js';

const ownerId = '00000000-0000-4000-8000-000000000001';
const dayPlanId = '00000000-0000-4000-8000-000000000002';
const anchorId = '00000000-0000-4000-8000-000000000003';
const newId = '00000000-0000-4000-8000-000000000004';
const proposalId = '00000000-0000-4000-8000-000000000005';

function block(overrides: Partial<PlanBlock> = {}): PlanBlock {
  return {
    id: anchorId,
    ownerId,
    dayPlanId,
    commitmentId: null,
    title: 'Canonical appointment',
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
    reasonForPlacement: 'Existing fixed anchor.',
    source: 'synthetic_fixture',
    ...overrides,
  };
}

function proposal(blocks: PlanBlock[], existing: PlanBlock[] = []): PlanProposal {
  return validatePlanProposal(
    {
      id: proposalId,
      ownerId,
      dayPlanId,
      trigger: 'conflict',
      proposedBlocks: blocks,
      tradeoffs: [],
      valid: false,
      validationErrors: [],
      createdAt: '2099-04-07T12:00:00.000Z',
    },
    existing,
  );
}

function harness(stored: PlanProposal, live: PlanBlock[], canonicalCommitments: unknown[] = []) {
  const writes: { table: unknown; values: unknown }[] = [];
  const locks: string[] = [];
  const deletes: unknown[] = [];
  const updates: { table: unknown; values: unknown }[] = [];
  const rows = live.map((item) => ({
    ...item,
    startAt: item.startAt ? new Date(item.startAt) : null,
    endAt: item.endAt ? new Date(item.endAt) : null,
    earliestStartAt: item.earliestStartAt ? new Date(item.earliestStartAt) : null,
    latestFinishAt: item.latestFinishAt ? new Date(item.latestFinishAt) : null,
  }));
  function query(result: unknown[]) {
    const promise = Promise.resolve(result);
    const chain = {
      where: () => chain,
      limit: () => chain,
      innerJoin: () => chain,
      for: (mode: string) => {
        locks.push(mode);
        return chain;
      },
      onConflictDoUpdate: () => chain,
      then: promise.then.bind(promise),
    };
    return chain;
  }
  const transaction = {
    select: () => ({
      from: (table: unknown) =>
        query(
          table === commitments
            ? canonicalCommitments
            : table === dayPlans
              ? [{ id: dayPlanId, revision: 1 }]
              : table === planProposals
                ? [
                    {
                      id: proposalId,
                      ownerId,
                      dayPlanId,
                      state: 'validated',
                      trigger: 'conflict',
                      proposal: stored,
                    },
                  ]
                : table === planBlocks
                  ? rows
                  : table === planBlockDependencies
                    ? live.flatMap((item) =>
                        item.dependencyIds.map((id) => ({
                          planBlockId: item.id,
                          dependsOnPlanBlockId: id,
                        })),
                      )
                    : [],
        ),
    }),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        writes.push({ table, values });
        return query([]);
      },
    }),
    update: (table: unknown) => ({
      set: (values: unknown) => {
        updates.push({ table, values });
        return query([]);
      },
    }),
    delete: (table: unknown) => {
      deletes.push(table);
      return query([]);
    },
  };
  const database = {
    transaction: (operation: (value: unknown) => Promise<unknown>) => operation(transaction),
  } as unknown as JarvisDatabase;
  const transport = {} as TransactionalJobTransport;
  const store = new DrizzleTransactionalEventStore(database, transport);
  const action: ProposedAction = {
    id: newId,
    ownerId,
    actionType: 'internal.plan.update',
    payload: { dayPlanId, planProposalId: proposalId },
    riskClass: 'LOW_RISK_INTERNAL',
    idempotencyKey: 'synthetic-plan-apply',
    correlationId: newId,
    state: 'proposed',
    expiresAt: null,
  };
  return {
    writes,
    updates,
    locks,
    deletes,
    apply: () =>
      store.transaction((boundary) =>
        boundary.executeInternalAction({
          proposedAction: action,
          evaluation: {
            allowed: true,
            requiresApproval: false,
            denied: false,
            reason: 'Synthetic permission.',
            policyVersion: 'test',
            matchedRules: [],
          },
        }),
      ),
  };
}

describe('live canonical plan apply guard', () => {
  it('denies a legacy hard-role emission disguised with a flexible anchor class', async () => {
    const stored = {
      ...proposal([]),
      valid: true,
      proposedBlocks: [block({ id: newId, anchorClass: 'flexible' })],
    };
    const test = harness(stored, []);
    await expect(test.apply()).rejects.toThrow(CanonicalPlanValidationError);
    expect(test.writes).toEqual([]);
  });

  it('rejects a previously valid mutation after a new overlapping anchor appears before apply', async () => {
    const newWork = block({
      id: newId,
      title: 'New work',
      anchorClass: 'flexible',
      role: 'work_block',
    });
    const stored = proposal([newWork]);
    expect(stored.valid).toBe(true);
    const test = harness(stored, [block()]);
    await expect(test.apply()).rejects.toThrow(CanonicalPlanValidationError);
    expect(test.locks).toEqual(['update']);
    expect(test.writes).toEqual([]);
  });

  it('rejects a flexible modification if the live canonical block became fixed before apply', async () => {
    const wasFlexible = block({ anchorClass: 'flexible', role: 'work_block' });
    const changed = { ...wasFlexible, title: 'Updated title' };
    const stored = proposal([changed], [wasFlexible]);
    expect(stored.valid).toBe(true);
    const test = harness(stored, [block()]);
    await expect(test.apply()).rejects.toThrow('no longer satisfies canonical plan constraints');
    expect(test.writes).toEqual([]);
  });

  it('normalizes a legacy exact protected duplicate at apply without inserting another block', async () => {
    const stored = { ...proposal([]), proposedBlocks: [block({ id: newId })] };
    const test = harness(stored, [block()]);
    await expect(test.apply()).resolves.toMatchObject({ targetId: dayPlanId });
    expect(test.writes.filter((write) => write.table === planBlocks)).toEqual([]);
    expect(test.deletes).toEqual([]);
    expect(test.updates.filter((update) => update.table === planProposals)).toHaveLength(1);
    expect(
      test.updates.find((update) => update.table === planProposals)?.values,
    ).not.toHaveProperty('proposal');
    expect(stored.proposedBlocks).toHaveLength(1);
  });

  it('persists a new non-overlapping mutation and its dependency while leaving its anchor untouched', async () => {
    const newWork = block({
      id: newId,
      title: 'New work',
      role: 'work_block',
      anchorClass: 'flexible',
      startAt: '2099-04-07T17:30:00.000Z',
      endAt: '2099-04-07T18:30:00.000Z',
      dependencyIds: [anchorId],
    });
    const stored = proposal([newWork], [block()]);
    const test = harness(stored, [block()]);
    await expect(test.apply()).resolves.toMatchObject({ targetId: dayPlanId });
    expect(test.writes.filter((write) => write.table === planBlocks)).toMatchObject([
      { values: { id: newId } },
    ]);
    expect(test.writes.filter((write) => write.table === planBlockDependencies)).toMatchObject([
      { values: [{ ownerId, planBlockId: newId, dependsOnPlanBlockId: anchorId }] },
    ]);
    expect(test.deletes).toEqual([planBlockDependencies]);
  });
});

describe('canonical commitment operation apply boundary', () => {
  const commitment = {
    id: proposalId,
    ownerId,
    title: 'Canonical task',
    priority: 80,
    source: 'canonical_owner',
    status: 'open',
    flexibility: 'flexible',
  };
  const scheduled = commitmentPlanBlock({
    id: newId,
    dayPlanId,
    commitment,
    startsAt: '2099-04-07T17:30:00.000Z',
    endsAt: '2099-04-07T18:00:00.000Z',
  });
  const stored: PlanProposal = {
    ...proposal([scheduled]),
    contractVersion: 'flexible_delta_v2',
    commitmentSchedules: [{ blockId: newId, commitmentId: commitment.id }],
  };
  it('applies canonical metadata and preserves original audit JSON', async () => {
    const h = harness(stored, [], [commitment]);
    await h.apply();
    expect(h.writes.some((write) => write.table === planBlocks)).toBe(true);
    expect(
      h.updates
        .filter((update) => update.table === planProposals)
        .every((update) => !('proposal' in (update.values as object))),
    ).toBe(true);
  });
  it.each([
    { status: 'completed' },
    { flexibility: 'fixed' },
    { title: 'Changed canonically' },
    { priority: 1 },
    { source: 'changed' },
  ])('fails closed when canonical commitment changed: %j', async (change) => {
    const h = harness(stored, [], [{ ...commitment, ...change }]);
    await expect(h.apply()).rejects.toBeInstanceOf(CanonicalPlanValidationError);
    expect(h.writes).toEqual([]);
  });
  it('rejects a commitment scheduled concurrently', async () => {
    const h = harness(stored, [scheduled], [commitment]);
    await expect(h.apply()).rejects.toBeInstanceOf(CanonicalPlanValidationError);
    expect(h.writes).toEqual([]);
  });
});
