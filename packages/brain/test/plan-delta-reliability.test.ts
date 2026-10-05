import { describe, expect, it } from 'vitest';

import type { BrainRequest, PlanBlock, PlanProposal } from '@jarvis/contracts';
import { protectedPlanMutationSchema, planProposalSchema } from '@jarvis/contracts';
import { modelDecisionEnvelopeSchema } from '../src/model/decision-schema.js';
import { PromptAssembler } from '../src/prompts/assembler.js';
import { reconcileConversationResponse } from '../src/conversation/outcome-response.js';

import { ContextAssembler } from '../src/context/assembler.js';
import { materializeModelDecision } from '../src/conversation/model-decision-mapper.js';
import { validatePlanProposal } from '../src/planning/constraint-validator.js';

const ownerId = '00000000-0000-4000-8000-000000000001';
const dayPlanId = '00000000-0000-4000-8000-000000000002';
const anchorId = '00000000-0000-4000-8000-000000000003';
const newId = '00000000-0000-4000-8000-000000000004';
const now = '2099-04-07T12:00:00.000Z';

function block(overrides: Partial<PlanBlock> = {}): PlanBlock {
  return {
    id: anchorId,
    ownerId,
    dayPlanId,
    commitmentId: null,
    title: 'Fixed appointment',
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
    reasonForPlacement: 'Canonical fixed appointment.',
    source: 'synthetic_fixture',
    ...overrides,
  };
}

function proposal(proposedBlocks: PlanBlock[]): PlanProposal {
  return {
    id: '00000000-0000-4000-8000-000000000005',
    ownerId,
    dayPlanId,
    trigger: 'conflict',
    proposedBlocks,
    tradeoffs: [],
    valid: false,
    validationErrors: [],
    createdAt: now,
  };
}

describe('delta-oriented canonical plans', () => {
  it('implicitly preserves every omitted protected anchor, including an empty mutation list', () => {
    const fixed = block({
      id: newId,
      anchorClass: 'fixed',
      startAt: '2099-04-07T19:00:00.000Z',
      endAt: '2099-04-07T20:00:00.000Z',
    });
    const result = validatePlanProposal(proposal([]), [block(), fixed]);
    expect(result).toMatchObject({
      valid: true,
      proposedBlocks: [],
      preservedBlockIds: [anchorId, newId],
    });
    expect(validatePlanProposal(result, [block(), fixed])).toEqual(result);
  });
  it('accepts only a new flexible non-overlapping block without requiring model anchor output', () => {
    const flexible = block({
      id: newId,
      anchorClass: 'flexible',
      role: 'work_block',
      startAt: '2099-04-07T17:30:00.000Z',
      endAt: '2099-04-07T18:30:00.000Z',
    });
    const result = validatePlanProposal(proposal([flexible]), [block()]);
    expect(result).toMatchObject({
      valid: true,
      proposedBlocks: [flexible],
      preservedBlockIds: [anchorId],
    });
    expect(validatePlanProposal(result, [block()])).toEqual(result);
  });
  it.each<Partial<PlanBlock>>([
    { title: 'Fixed appointment edited' },
    { priority: 99 },
    { startAt: '2099-04-07T18:00:00.000Z', endAt: '2099-04-07T19:00:00.000Z' },
  ])('rejects changed unreferenced anchors even without overlap: %j', (change) => {
    const result = validatePlanProposal(proposal([block({ id: newId, ...change })]), [block()]);
    expect(result.valid).toBe(false);
    expect(result.preservedBlockIds).toEqual([anchorId]);
    expect(result.validationErrors.join(' ')).toContain('explicit existingBlockId and authority');
  });
  it('rejects cancellation of a protected anchor even with canonical identity', () => {
    const result = validatePlanProposal(proposal([block({ completionState: 'cancelled' })]), [
      block(),
    ]);
    expect(result.valid).toBe(false);
    expect(result.validationErrors.join(' ')).toContain('cannot be modified');
  });
  it('removes an explicitly referenced unchanged anchor from mutations and keeps its canonical ID', () => {
    const canonical = block({ completionState: 'in_progress' });
    const input = proposal([
      block({
        completionState: 'in_progress',
        source: 'brain_proposal',
        reasonForPlacement: 'Keep it.',
      }),
    ]);
    const result = validatePlanProposal(input, [canonical]);
    expect(result).toMatchObject({
      valid: true,
      proposedBlocks: [],
      preservedBlockIds: [anchorId],
    });
    expect(canonical.source).toBe('synthetic_fixture');
    expect(input.proposedBlocks).toHaveLength(1);
    expect(validatePlanProposal(result, [canonical])).toEqual(result);
  });

  it('normalizes only a unique exact unreferenced protected duplicate into preservation', () => {
    const result = validatePlanProposal(proposal([block({ id: newId })]), [block()]);
    expect(result).toMatchObject({
      valid: true,
      proposedBlocks: [],
      preservedBlockIds: [anchorId],
    });
  });

  it('rejects a genuinely new overlapping block even at exactly the same time', () => {
    const result = validatePlanProposal(
      proposal([
        block({
          id: newId,
          title: 'A separate appointment',
          anchorClass: 'flexible',
          role: 'work_block',
        }),
      ]),
      [block()],
    );
    expect(result.valid).toBe(false);
    expect(result.proposedBlocks).toHaveLength(1);
    expect(result.validationErrors.join(' ')).toContain('overlap');
  });

  it('rejects ambiguous duplicate identity instead of guessing which canonical block to preserve', () => {
    const result = validatePlanProposal(proposal([block({ id: newId })]), [
      block(),
      block({ id: '00000000-0000-4000-8000-000000000006' }),
    ]);
    expect(result.valid).toBe(false);
    expect(result.proposedBlocks).toHaveLength(1);
    expect(result.preservedBlockIds).toEqual([anchorId, '00000000-0000-4000-8000-000000000006']);
    expect(result.validationErrors.join(' ')).toContain('ambiguous canonical identity');
  });

  it.each<Partial<PlanBlock>>([
    { startAt: '2099-04-07T16:30:00.000Z' },
    { anchorClass: 'flexible' },
    { role: 'optional_block' },
    { estimatedDurationMinutes: 30 },
    { priority: 1 },
    { title: 'Renamed anchor' },
    { minimumDurationMinutes: 10 },
    { earliestStartAt: '2099-04-07T15:00:00.000Z' },
    { completionState: 'completed' },
    { dependencyIds: [newId] },
  ])('rejects a protected attribute change even with explicit canonical identity: %j', (change) => {
    const result = validatePlanProposal(proposal([block(change)]), [block()]);
    expect(result.valid).toBe(false);
    expect(result.validationErrors.join(' ')).toContain('cannot be modified');
  });

  it('does not hide duplicate references while normalizing unchanged blocks', () => {
    expect(validatePlanProposal(proposal([block(), block()]), [block()]).valid).toBe(false);
    expect(validatePlanProposal(proposal([block(), block({ id: newId })]), [block()]).valid).toBe(
      false,
    );
  });

  it('retains omitted flexible canonical blocks in collision checks to match upsert persistence', () => {
    const existing = block({ role: 'work_block', anchorClass: 'flexible' });
    const result = validatePlanProposal(proposal([block({ id: newId, title: 'New work' })]), [
      existing,
    ]);
    expect(result.valid).toBe(false);
    expect(result.validationErrors.join(' ')).toContain('overlap');
  });

  it('allows a non-overlapping flexible update by canonical ID and a dependency on an omitted anchor', () => {
    const flexible = block({
      id: newId,
      role: 'work_block',
      anchorClass: 'flexible',
      startAt: '2099-04-07T17:00:00.000Z',
      endAt: '2099-04-07T18:00:00.000Z',
    });
    const moved = {
      ...flexible,
      startAt: '2099-04-07T18:00:00.000Z',
      endAt: '2099-04-07T19:00:00.000Z',
      dependencyIds: [anchorId],
    };
    const result = validatePlanProposal(proposal([moved]), [block(), flexible]);
    expect(result.valid).toBe(true);
    expect(result.proposedBlocks).toEqual([moved]);
  });

  it('rejects foreign preservation references', () => {
    const input = { ...proposal([]), preservedBlockIds: [anchorId] };
    expect(validatePlanProposal(input, [block({ ownerId: newId })]).valid).toBe(false);
    expect(validatePlanProposal(input, [block({ dayPlanId: newId })]).valid).toBe(false);
  });

  it('rejects contradictory preserved references and mutations', () => {
    const canonical = block({ anchorClass: 'flexible' });
    const input = {
      ...proposal([{ ...canonical, title: 'Changed title' }]),
      preservedBlockIds: [anchorId],
    };
    const result = validatePlanProposal(input, [canonical]);
    expect(result.valid).toBe(false);
    expect(result.validationErrors.join(' ')).toContain('both preserved and modified');
  });
});

describe('flexible-only model replan contract', () => {
  const request: BrainRequest = {
    id: newId,
    ownerId,
    conversationId: newId,
    sourceEventId: null,
    messageId: null,
    purpose: 'replan',
    idempotencyKey: 'synthetic-flexible-only',
    correlationId: newId,
    causationId: null,
    requestedAt: now,
    state: 'received',
  };
  const context = new ContextAssembler({
    maxContextRecords: 10,
    maxRecentMessages: 10,
    maxApproxPromptTokens: 6000,
  }).assemble({
    request,
    now,
    records: [
      {
        recordId: dayPlanId,
        recordType: 'day_plan',
        ownerId,
        source: 'synthetic',
        informationState: 'known',
        confidenceBasisPoints: 10000,
        sensitivity: 'normal',
        observedAt: now,
        content: JSON.stringify({ hardAnchor: block() }),
        entityReferences: [anchorId],
        constitutionalRelevance: 0,
        activeCommitmentRelevance: 100,
        deadlineProximityMinutes: 240,
        currentDayRelevance: 100,
        sourceAuthority: 100,
      },
    ],
    hardOverrideIds: [],
    availableData: [],
  });
  const commitment = {
    id: newId,
    ownerId,
    title: 'Canonical admin task',
    priority: 80,
    status: 'open',
    flexibility: 'flexible',
    source: 'canonical_owner',
  };
  const commitmentRecord = {
    ...context.records[0]!,
    recordId: newId,
    recordType: 'commitment' as const,
    content: 'Intentionally no canonical title or priority in prose.',
  };
  context.records.push(commitmentRecord);
  context.manifest.selectedRecords.push({
    ...context.manifest.selectedRecords[0]!,
    recordId: newId,
    recordType: 'commitment',
  });
  function operation(overrides: Record<string, unknown> = {}) {
    return {
      operation: 'schedule_existing_commitment',
      commitmentId: newId,
      startsAt: '2099-04-07T17:30:00.000Z',
      endsAt: '2099-04-07T18:00:00.000Z',
      ...overrides,
    };
  }
  function envelope(blocks: unknown[], extra: Record<string, unknown> = {}) {
    return {
      decisionType: 'replan',
      conversationResponse: { message: 'Moved.', nextAction: 'Done.', tone: 'neutral' },
      reasoningSummary: {
        decisionSummary: 'Use the free window.',
        importantEvidenceIds: [],
        materialTradeoffs: [],
        confidenceBasisPoints: 9000,
        missingInformation: [],
      },
      evidence: [],
      clarification: null,
      proposedActions: [],
      memoryCandidates: [],
      reminderProposal: null,
      interventionProposal: null,
      planProposal: {
        dayPlanId,
        trigger: 'conflict',
        operations: blocks,
        newFlexibleBlocks: [],
        tradeoffs: [],
        ...extra,
      },
    };
  }
  function materialize(rawDecision: unknown, canonical = block()) {
    return materializeModelDecision({
      context,
      canonicalCommitments: [commitment],
      authorizedNewFlexibleBlockTitles: ['New owner request', 'Fixed appointment'],
      decisionId: newId,
      now,
      existingPlanBlocks: [canonical],
      allowedDayPlanIds: [dayPlanId],
      isSupportedIntervention: () => true,
      rawDecision,
    });
  }
  it('versions changes-only semantics and schedules a visible commitment using ID plus time only', () => {
    const prompt = new PromptAssembler().assemble({
      context,
      purpose: 'replan',
      ownerMessage: 'Schedule the task.',
    });
    expect(prompt.input).toContain(anchorId);
    expect(prompt.instructions).toContain('planning-flexible-delta-v2@3.0.0');
    expect(prompt.instructions).toContain(
      'Never restate, reproduce, copy, or recreate existing schedule blocks',
    );
    expect(prompt.instructions).toContain('omission does not delete anything');
    const result = materialize(envelope([operation()]));
    expect(result.planProposal).toMatchObject({
      valid: true,
      preservedBlockIds: [anchorId],
      proposedBlocks: [
        {
          title: commitment.title,
          priority: 80,
          source: commitment.source,
          commitmentId: newId,
          role: 'commitment',
          anchorClass: 'commitment_linked',
          estimatedDurationMinutes: 30,
        },
      ],
    });
    expect(result.planProposal?.proposedBlocks).toHaveLength(1);
    expect(validatePlanProposal(result.planProposal!, [block()])).toEqual(result.planProposal);
  });
  it('omission preserves the entire canonical anchor', () => {
    const canonical = block({ completionState: 'in_progress' });
    const before = JSON.stringify(canonical);
    expect(materialize(envelope([]), canonical).planProposal).toMatchObject({
      valid: true,
      proposedBlocks: [],
      preservedBlockIds: [anchorId],
    });
    expect(JSON.stringify(canonical)).toBe(before);
  });
  it.each([
    { title: 'Invented title' },
    { priority: 0 },
    { role: 'hard_external_anchor' },
    { existingBlockId: anchorId },
  ])('rejects model reconstruction of canonical metadata: %j', (extra) => {
    expect(modelDecisionEnvelopeSchema.safeParse(envelope([operation(extra)])).success).toBe(false);
  });
  it('rejects appointment restatement as a commitment or free-form creation', () => {
    expect(() => materialize(envelope([operation({ commitmentId: anchorId })]))).toThrow();
    expect(() =>
      materialize(
        envelope([], {
          newFlexibleBlocks: [
            {
              title: 'Fixed appointment',
              startsAt: '2099-04-07T18:00:00.000Z',
              endsAt: '2099-04-07T19:00:00.000Z',
            },
          ],
        }),
      ),
    ).toThrow('existing state cannot be restated');
  });
  it('denies unapproved free-form creation even when paraphrased', () => {
    expect(() =>
      materialize(
        envelope([], {
          newFlexibleBlocks: [
            {
              title: 'Renamed appointment',
              startsAt: '2099-04-07T18:00:00.000Z',
              endsAt: '2099-04-07T19:00:00.000Z',
            },
          ],
        }),
      ),
    ).toThrow('trusted owner authorization');
  });
  it('allows separately authorized genuinely new movable blocks without canonical metadata controls', () => {
    const newBlock = {
      title: 'New owner request',
      startsAt: '2099-04-07T18:00:00.000Z',
      endsAt: '2099-04-07T19:00:00.000Z',
    };
    expect(materialize(envelope([], { newFlexibleBlocks: [newBlock] })).planProposal?.valid).toBe(
      true,
    );
    for (const extra of [
      { anchorClass: 'fixed' },
      { role: 'hard_external_anchor' },
      { existingBlockId: anchorId },
      { commitmentId: newId },
    ]) {
      expect(
        modelDecisionEnvelopeSchema.safeParse(
          envelope([], { newFlexibleBlocks: [{ ...newBlock, ...extra }] }),
        ).success,
      ).toBe(false);
    }
  });
  it('protected mutation and preservation fields remain unavailable regardless of explicit ID', () => {
    expect(protectedPlanMutationSchema.safeParse({ operation: 'remove' }).success).toBe(false);
    for (const extra of [
      { protectedBlockMutations: [{ operation: 'remove', existingBlockId: anchorId }] },
      { preservedBlockIds: [anchorId] },
    ]) {
      expect(modelDecisionEnvelopeSchema.safeParse(envelope([], extra)).success).toBe(false);
    }
  });
  it('rejects real overlap and reconciles false completion wording', () => {
    const result = materialize(
      envelope([operation({ startsAt: block().startAt, endsAt: block().endAt })]),
    );
    expect(result.planProposal?.valid).toBe(false);
    expect(result.planProposal?.validationErrors.join(' ')).toContain('overlap');
    expect(
      reconcileConversationResponse(result.decision.conversationResponse, [
        { subject: 'plan', state: 'rejected' },
      ])?.message,
    ).toContain('could not be applied');
  });
  it('rejects duplicate commitment scheduling and unavailable canonical metadata', () => {
    expect(() => materialize(envelope([operation(), operation()]))).toThrow('unscheduled');
    expect(() => materialize(envelope([operation()]), block({ commitmentId: newId }))).toThrow(
      'unscheduled',
    );
    const run = (canonicalCommitments: unknown) =>
      materializeModelDecision({
        rawDecision: envelope([operation()]),
        context,
        decisionId: newId,
        now,
        existingPlanBlocks: [block()],
        allowedDayPlanIds: [dayPlanId],
        isSupportedIntervention: () => true,
        canonicalCommitments: canonicalCommitments as [typeof commitment],
      });
    for (const records of [
      [],
      [{ ...commitment, ownerId: anchorId }],
      [{ ...commitment, status: 'completed' }],
      [{ ...commitment, flexibility: 'fixed' }],
    ])
      expect(() => run(records)).toThrow();
  });
  it('v2 does no protected identity normalization and derives preservation independently of supplied IDs', () => {
    const result = validatePlanProposal(
      {
        ...proposal([block({ id: newId })]),
        contractVersion: 'flexible_delta_v2',
        preservedBlockIds: [newId],
      },
      [block()],
    );
    expect(result.valid).toBe(false);
    expect(result.proposedBlocks).toHaveLength(1);
    expect(result.preservedBlockIds).toEqual([anchorId]);
    expect(validatePlanProposal(result, [block()])).toEqual(result);
  });
  it('reads legacy persisted proposals without rewriting or assigning a new version', () => {
    const legacy = proposal([block({ id: newId })]);
    const before = JSON.stringify(legacy);
    expect(planProposalSchema.parse(legacy).contractVersion).toBeUndefined();
    expect(validatePlanProposal(legacy, [block()])).toMatchObject({
      valid: true,
      proposedBlocks: [],
    });
    expect(JSON.stringify(legacy)).toBe(before);
  });
});
