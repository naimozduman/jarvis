import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { OwnerTurnFeedback } from '@jarvis/contracts';
import { createDatabaseRuntime } from '../src/client.js';
import { DrizzleBrainRepository } from '../src/brain-repository.js';
import { loadOwnerFeedbackContext } from '../src/owner-feedback.js';
import {
  auditEvents,
  brainDecisions,
  brainRequests,
  commitments,
  constitutionProposals,
  conversations,
  dayPlans,
  events,
  memoryCandidates,
  memoryEvidence,
  memoryRecords,
  messages,
  owners,
  personalityTraits,
  planBlocks,
} from '../src/schema/index.js';

const testUrl = process.env.JARVIS_TEST_DATABASE_URL;
const runtimes: ReturnType<typeof createDatabaseRuntime>[] = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.pool.end()));
});

async function fixture() {
  if (!testUrl) throw new Error('Disposable test URL required.');
  const parsed = new URL(testUrl);
  if (
    !['localhost', '127.0.0.1', '::1', 'postgres'].includes(parsed.hostname) ||
    !parsed.pathname.includes('test')
  ) {
    throw new Error('Owner feedback tests require a disposable local test database.');
  }
  const runtime = createDatabaseRuntime({ connectionString: testUrl, maxConnections: 3 });
  runtimes.push(runtime);
  const db = runtime.db;
  const ownerId = randomUUID(),
    conversationId = randomUUID(),
    correlationId = randomUUID();
  const now = Date.now();
  await db.insert(owners).values({
    id: ownerId,
    emailNormalized: `${ownerId}@example.invalid`,
    displayName: 'Synthetic daily-use owner',
    timezone: 'America/Chicago',
  });
  await db.insert(conversations).values({ id: conversationId, ownerId, channel: 'telegram' });
  async function completedTurn(at: number) {
    const eventId = randomUUID(),
      requestId = randomUUID(),
      decisionId = randomUUID(),
      responseId = randomUUID();
    await db.insert(events).values({
      id: eventId,
      ownerId,
      eventType: 'synthetic.owner_turn.v1',
      source: 'internal',
      idempotencyKey: `synthetic:${eventId}`,
      occurredAt: new Date(at),
      receivedAt: new Date(at),
      payload: {},
      payloadHash: 'synthetic',
      schemaVersion: 1,
      correlationId,
    });
    await db.insert(brainRequests).values({
      id: requestId,
      ownerId,
      conversationId,
      sourceEventId: eventId,
      purpose: 'conversation',
      state: 'completed',
      idempotencyKey: `synthetic:${requestId}`,
      correlationId,
      completedAt: new Date(at),
    });
    await db.insert(brainDecisions).values({
      id: decisionId,
      ownerId,
      brainRequestId: requestId,
      decisionType: 'answer',
      decisionSummary: 'Synthetic bounded answer.',
      materialTradeoffs: [],
      confidenceBasisPoints: 9_000,
      missingInformation: [],
      validationState: 'validated',
      promptVersion: 'synthetic',
      contextVersion: 'synthetic',
      executionResult: {},
      correlationId,
    });
    await db.insert(messages).values({
      id: responseId,
      ownerId,
      conversationId,
      sourceEventId: eventId,
      channel: 'telegram',
      direction: 'outbound',
      contentType: 'text/plain',
      content: 'Synthetic prior JARVIS reply.',
      deliveryState: 'sent',
      occurredAt: new Date(at),
      receivedAt: new Date(at),
      correlationId,
    });
    return { decisionId, responseId, requestId, eventId };
  }
  const target = await completedTurn(now - 10_000);
  const repository = new DrizzleBrainRepository(db);
  async function feedback(value: OwnerTurnFeedback, at = now) {
    const messageId = randomUUID();
    await db.insert(messages).values({
      id: messageId,
      ownerId,
      conversationId,
      channel: 'telegram',
      direction: 'inbound',
      contentType: 'text/plain',
      content: value.quote,
      deliveryState: 'local_persisted',
      occurredAt: new Date(at),
      receivedAt: new Date(at),
      correlationId,
    });
    const input = {
      ownerId,
      conversationId,
      messageId,
      sourceEventId: null,
      correlationId,
      occurredAt: new Date(at).toISOString(),
      channel: 'telegram',
      feedback: value,
    };
    return { input, result: await repository.recordOwnerFeedback(input) };
  }
  return {
    db,
    repository,
    ownerId,
    conversationId,
    correlationId,
    now,
    target,
    completedTurn,
    feedback,
  };
}

const short: OwnerTurnFeedback = {
  category: 'brevity',
  scope: 'one_turn',
  directive: 'shorter',
  quote: 'too long',
};
describe.skipIf(!testUrl)('disposable PostgreSQL owner correction loop', () => {
  test('rolls back a failed challenge finalization and recovers its response and idempotent marker on replay', async () => {
    const f = await fixture(),
      commitmentId = randomUUID(),
      responseMessageId = randomUUID();
    await f.db.insert(commitments).values({
      id: commitmentId,
      ownerId: f.ownerId,
      title: 'Workout',
      source: 'synthetic',
      status: 'open',
    });
    const inboundId = randomUUID();
    await f.db.insert(messages).values({
      id: inboundId,
      ownerId: f.ownerId,
      conversationId: f.conversationId,
      sourceEventId: f.target.eventId,
      channel: 'telegram',
      direction: 'inbound',
      contentType: 'text/plain',
      content: 'Skip Workout.',
      deliveryState: 'local_persisted',
      occurredAt: new Date(f.now),
      receivedAt: new Date(f.now),
      correlationId: f.correlationId,
    });
    await f.db
      .update(brainRequests)
      .set({ messageId: inboundId, state: 'decision_persisted' })
      .where(eq(brainRequests.id, f.target.requestId));
    const response = {
      message: 'Try the ten-minute walk.',
      nextAction: null,
      tone: 'direct' as const,
    };
    await f.repository.updateDecisionExecutionResult({
      ownerId: f.ownerId,
      decisionId: f.target.decisionId,
      executionResult: {
        dailyUseFinalization: 1,
        responseMessageId,
        finalConversationResponse: response,
        interventionSuppressed: false,
        accountability: {
          commitmentId,
          explicitHardOverride: false,
          outcome: { kind: 'reduce_to_minimum_viable_action', challengeLevel: 'direct' },
        },
      },
    });
    const input = {
      requestId: f.target.requestId,
      decisionId: f.target.decisionId,
      challengeCommitmentId: commitmentId,
      ownerOverride: null,
      response: {
        id: responseMessageId,
        ownerId: f.ownerId,
        conversationId: f.conversationId,
        sourceEventId: f.target.eventId,
        correlationId: f.correlationId,
        occurredAt: new Date(f.now).toISOString(),
        channel: 'telegram' as const,
        response,
      },
    };
    const failure = vi
      .spyOn(DrizzleBrainRepository.prototype, 'recordAccountabilityChallenge')
      .mockRejectedValueOnce(new Error('Synthetic audit write failure'));
    try {
      await expect(f.repository.finalizeDailyUseTurn(input)).rejects.toThrow(
        'Synthetic audit write failure',
      );
    } finally {
      failure.mockRestore();
    }
    expect(
      await f.db.select().from(messages).where(eq(messages.id, responseMessageId)),
    ).toHaveLength(0);
    const [pending] = await f.db
      .select()
      .from(brainRequests)
      .where(eq(brainRequests.id, f.target.requestId));
    expect(pending?.state).toBe('decision_persisted');
    expect(
      await f.repository.recoverDailyUseTurn({
        ownerId: f.ownerId,
        requestId: f.target.requestId,
        responseMessageId,
      }),
    ).toBe(true);
    expect(
      await f.repository.recoverDailyUseTurn({
        ownerId: f.ownerId,
        requestId: f.target.requestId,
        responseMessageId,
      }),
    ).toBe(true);
    expect(
      await f.db.select().from(messages).where(eq(messages.id, responseMessageId)),
    ).toHaveLength(1);
    expect(
      await f.db.select().from(auditEvents).where(eq(auditEvents.ownerId, f.ownerId)),
    ).toHaveLength(1);
    const [completed] = await f.db
      .select()
      .from(brainRequests)
      .where(eq(brainRequests.id, f.target.requestId));
    expect(completed?.state).toBe('completed');
    expect(
      (
        await f.repository.loadDailyUseState({
          ownerId: f.ownerId,
          now: new Date(f.now + 1_000).toISOString(),
        })
      ).commitments[0]?.alreadyChallenged,
    ).toBe(true);
  });
  test('binds one-turn evidence to the completed turn without activating a trait', async () => {
    const f = await fixture();
    const { result } = await f.feedback(short);
    expect(result).toMatchObject({
      targetDecisionId: f.target.decisionId,
      targetResponseId: f.target.responseId,
      scope: 'one_turn',
      repeatedEvidenceCount: 1,
    });
    const candidates = await f.db
      .select()
      .from(memoryCandidates)
      .where(eq(memoryCandidates.ownerId, f.ownerId));
    expect(candidates[0]).toMatchObject({
      kind: 'observation',
      state: 'pending_review',
      requiresOwnerConfirmation: true,
    });
    expect(
      await f.db.select().from(memoryRecords).where(eq(memoryRecords.ownerId, f.ownerId)),
    ).toHaveLength(0);
    expect(
      await f.db.select().from(personalityTraits).where(eq(personalityTraits.ownerId, f.ownerId)),
    ).toHaveLength(0);
    expect(
      await f.db.select().from(auditEvents).where(eq(auditEvents.ownerId, f.ownerId)),
    ).toHaveLength(1);
  });
  test('replays idempotently and rejects altered replay evidence', async () => {
    const f = await fixture();
    const { input, result } = await f.feedback(short);
    expect((await f.repository.recordOwnerFeedback(input)).candidateId).toBe(result.candidateId);
    expect(
      await f.db.select().from(memoryEvidence).where(eq(memoryEvidence.ownerId, f.ownerId)),
    ).toHaveLength(1);
    await expect(
      f.repository.recordOwnerFeedback({ ...input, feedback: { ...short, directive: 'natural' } }),
    ).rejects.toThrow('replay');
    await expect(
      f.repository.recordOwnerFeedback({ ...input, feedback: { ...short, category: 'tone' } }),
    ).rejects.toThrow('replay');
  });
  test('a newer failed or unsent response cannot steal feedback from a provider-accepted completed turn', async () => {
    const f = await fixture();
    const unsent = await f.completedTurn(f.now - 1_000);
    await f.db
      .update(messages)
      .set({ deliveryState: 'failed' })
      .where(eq(messages.id, unsent.responseId));
    const { result } = await f.feedback(short);
    expect(result.targetResponseId).toBe(f.target.responseId);
    await f.db
      .update(messages)
      .set({ deliveryState: 'local_persisted' })
      .where(eq(messages.id, unsent.responseId));
    const next = await f.feedback(short, f.now + 1_000);
    expect(next.result.targetResponseId).toBe(f.target.responseId);
  });
  test('counts distinct completed turns and keeps repeated evidence provisional', async () => {
    const f = await fixture();
    await f.feedback(short);
    await f.feedback(short, f.now + 1_000);
    await f.feedback(short, f.now + 2_000);
    expect(
      await loadOwnerFeedbackContext(f.db, {
        ownerId: f.ownerId,
        now: new Date(f.now + 3_000).toISOString(),
      }),
    ).toHaveLength(0);
    for (let i = 1; i <= 2; i++) {
      await f.completedTurn(f.now + i * 60_000 - 1_000);
      const { result } = await f.feedback(short, f.now + i * 60_000);
      expect(result.repeatedEvidenceCount).toBe(i + 1);
    }
    const context = await loadOwnerFeedbackContext(f.db, {
      ownerId: f.ownerId,
      now: new Date(f.now + 120_000).toISOString(),
    });
    expect(context[0]?.recordType).toBe('preference_evidence');
    expect(JSON.parse(context[0]!.content)).toMatchObject({
      distinctCompletedTurns: 3,
      provisional: true,
      activatedPersonalityRule: false,
    });
    expect(
      await f.db.select().from(memoryRecords).where(eq(memoryRecords.ownerId, f.ownerId)),
    ).toHaveLength(0);
  });
  test('persists explicit presentation preferences and audited mode transitions with supersession', async () => {
    const f = await fixture();
    await f.feedback({
      ...short,
      scope: 'explicit_owner_preference',
      quote: 'from now on be shorter',
    });
    await f.feedback(
      {
        category: 'mode',
        scope: 'explicit_owner_preference',
        directive: 'mentor',
        quote: 'mentor mode',
      },
      f.now + 1_000,
    );
    await f.feedback(
      {
        category: 'mode',
        scope: 'explicit_owner_preference',
        directive: 'default',
        quote: 'default mode',
      },
      f.now + 2_000,
    );
    const records = await f.db
      .select()
      .from(memoryRecords)
      .where(eq(memoryRecords.ownerId, f.ownerId));
    expect(records.filter((row) => row.active)).toHaveLength(2);
    expect(records.filter((row) => !row.active)).toHaveLength(1);
    const audits = await f.db.select().from(auditEvents).where(eq(auditEvents.ownerId, f.ownerId));
    expect(audits).toHaveLength(3);
    expect(audits.every((row) => row.metadata.authorityChanged === false)).toBe(true);
    const state = await f.repository.loadDailyUseState({
      ownerId: f.ownerId,
      now: new Date(f.now + 3_000).toISOString(),
    });
    expect(state.records.filter((row) => row.recordType === 'owner_preference')).toHaveLength(2);
  });
  test('keeps constitution candidates in draft without active constitution changes', async () => {
    const f = await fixture();
    await f.feedback({
      category: 'rule',
      scope: 'constitution_candidate',
      directive: 'Protect training.',
      quote: 'Constitution proposal: Protect training.',
    });
    const proposals = await f.db
      .select()
      .from(constitutionProposals)
      .where(eq(constitutionProposals.ownerId, f.ownerId));
    expect(proposals[0]?.state).toBe('draft');
    expect(
      (
        await f.repository.loadDailyUseState({
          ownerId: f.ownerId,
          now: new Date(f.now).toISOString(),
        })
      ).records,
    ).toHaveLength(0);
  });
  test('rejects foreign ownership and mismatched source text', async () => {
    const f = await fixture();
    const { input } = await f.feedback(short);
    await expect(
      f.repository.recordOwnerFeedback({ ...input, ownerId: randomUUID() }),
    ).rejects.toThrow('canonical inbound');
    const messageId = randomUUID();
    await f.db.insert(messages).values({
      id: messageId,
      ownerId: f.ownerId,
      conversationId: f.conversationId,
      channel: 'telegram',
      direction: 'inbound',
      contentType: 'text/plain',
      content: 'hello',
      deliveryState: 'local_persisted',
      occurredAt: new Date(f.now),
      receivedAt: new Date(f.now),
      correlationId: f.correlationId,
    });
    await expect(f.repository.recordOwnerFeedback({ ...input, messageId })).rejects.toThrow(
      'exact canonical inbound',
    );
  });
  test('loads canonical commitments and challenge history without marking silent work complete', async () => {
    const f = await fixture(),
      commitmentId = randomUUID();
    await f.db.insert(commitments).values({
      id: commitmentId,
      ownerId: f.ownerId,
      title: 'Workout',
      source: 'synthetic',
      priority: 80,
      status: 'open',
    });
    await f.repository.recordAccountabilityChallenge({
      ownerId: f.ownerId,
      commitmentId,
      decisionId: f.target.decisionId,
      correlationId: f.correlationId,
      now: new Date(f.now).toISOString(),
    });
    const state = await f.repository.loadDailyUseState({
      ownerId: f.ownerId,
      now: new Date(f.now).toISOString(),
    });
    expect(state.commitments[0]).toMatchObject({
      id: commitmentId,
      title: 'Workout',
      alreadyChallenged: true,
      constraintsKnown: false,
    });
    const [unchanged] = await f.db
      .select()
      .from(commitments)
      .where(and(eq(commitments.id, commitmentId), eq(commitments.ownerId, f.ownerId)));
    expect(unchanged?.status).toBe('open');
    expect(
      (
        await f.repository.listContextRecords({
          ownerId: f.ownerId,
          conversationId: f.conversationId,
          maximumRecentMessages: 12,
        })
      )[0]?.content,
    ).toContain('JARVIS:');
  });
  test('distinguishes owner-local same-day alternatives from tomorrow near midnight', async () => {
    const f = await fixture(),
      commitmentId = randomUUID(),
      dayPlanId = randomUUID();
    await f.db.insert(commitments).values({
      id: commitmentId,
      ownerId: f.ownerId,
      title: 'Workout',
      source: 'synthetic',
      status: 'open',
    });
    await f.db.insert(dayPlans).values({
      id: dayPlanId,
      ownerId: f.ownerId,
      localDate: '2026-10-02',
      timezone: 'America/Chicago',
      source: 'synthetic',
    });
    await f.db.insert(planBlocks).values({
      id: randomUUID(),
      ownerId: f.ownerId,
      dayPlanId,
      commitmentId,
      blockKind: 'flexible',
      title: 'Workout',
      source: 'synthetic',
      startAt: new Date('2026-10-02T05:30:00.000Z'),
      endAt: new Date('2026-10-02T06:00:00.000Z'),
      estimatedDurationMinutes: 30,
      minimumDurationMinutes: 10,
    });
    const state = await f.repository.loadDailyUseState({
      ownerId: f.ownerId,
      now: '2026-10-02T04:45:00.000Z',
    });
    expect(state.commitments[0]).toMatchObject({
      alternateWindowsToday: 0,
      nextProtectedWindowExists: true,
    });
  });
  test('persists a bounded explicit owner override idempotently and keeps the commitment open', async () => {
    const f = await fixture(),
      commitmentId = randomUUID(),
      messageId = randomUUID();
    await f.db.insert(commitments).values({
      id: commitmentId,
      ownerId: f.ownerId,
      title: 'Workout',
      source: 'synthetic',
      status: 'open',
    });
    const statement = 'Hard override: skip Workout today.';
    await f.db.insert(messages).values({
      id: messageId,
      ownerId: f.ownerId,
      conversationId: f.conversationId,
      channel: 'telegram',
      direction: 'inbound',
      contentType: 'text/plain',
      content: statement,
      deliveryState: 'local_persisted',
      occurredAt: new Date(f.now),
      receivedAt: new Date(f.now),
      correlationId: f.correlationId,
    });
    const input = {
      ownerId: f.ownerId,
      conversationId: f.conversationId,
      commitmentId,
      messageId,
      statement,
      sourceEventId: null,
      correlationId: f.correlationId,
      now: new Date(f.now).toISOString(),
    };
    await f.repository.recordOwnerAccountabilityOverride(input);
    await f.repository.recordOwnerAccountabilityOverride(input);
    expect(
      (await f.repository.loadDailyUseState({ ownerId: f.ownerId, now: input.now })).commitments[0],
    ).toMatchObject({ hardOverrideActive: true, overrideConsequenceExplained: true });
    expect(
      (
        await f.repository.loadDailyUseState({
          ownerId: f.ownerId,
          now: new Date(f.now + 86_400_001).toISOString(),
        })
      ).commitments[0]?.hardOverrideActive,
    ).toBe(false);
    expect(
      await f.db.select().from(auditEvents).where(eq(auditEvents.ownerId, f.ownerId)),
    ).toHaveLength(1);
    const [unchanged] = await f.db
      .select()
      .from(commitments)
      .where(eq(commitments.id, commitmentId));
    expect(unchanged?.status).toBe('open');
  });
});
