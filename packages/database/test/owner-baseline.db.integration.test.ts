import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  ContextAssembler,
  ConversationTurnService,
  FakeModelGateway,
  PromptAssembler,
  InterventionService,
  type ConversationTurnInput,
} from '@jarvis/brain';
import type { OwnerBaselineProposal } from '@jarvis/contracts';
import { evaluatePolicy } from '@jarvis/security';
import {
  createDatabaseRuntime,
  DrizzleBrainRepository,
  DrizzleTransactionalEventStore,
  CanonicalOnlyDurableJobTransport,
  owners,
  conversations,
  messages,
  events,
  messagingIdentityAliases,
  messagingTransportConnections,
  telegramBotParticipants,
  memoryCandidates,
  memoryRecords,
  memoryEvidence,
  constitutionProposals,
  constitutionItems,
  constitutionItemVersions,
  projects,
  people,
  preferences,
  commitments,
  personalityTraits,
  reminders,
  jobs,
  auditEvents,
  onboardingAnswers,
  brainDecisions,
} from '../src/index.js';

const testUrl = process.env.JARVIS_TEST_DATABASE_URL;
const runtimes: ReturnType<typeof createDatabaseRuntime>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
});
function item(
  kind: OwnerBaselineProposal['kind'],
  title: string,
  statement: string,
  extra: Partial<OwnerBaselineProposal> = {},
): OwnerBaselineProposal {
  return {
    kind,
    title,
    statement,
    sourceQuote: statement,
    confidenceBasisPoints: 9000,
    sensitivity: 'normal',
    temporary: false,
    validUntil: null,
    personalContextName: null,
    ...extra,
  };
}
const baseline = [
  item('constitution_candidate', 'Atlas goal', 'My main goal is to launch Atlas within 12 months.'),
  item('preference', 'Direct answers', 'I prefer short direct answers unless I ask for detail.'),
  item('project', 'Atlas', 'Atlas is my current active software project.'),
  item('commitment', 'Atlas proposal', 'I commit to send the Atlas proposal by Friday.'),
  item('person', 'Mira', 'Mira is my mentor and I value her practical advice.'),
  item('fact', 'Owner work', 'I work as a software developer.'),
  item('open_loop', 'Atlas pricing', 'I need to decide Atlas pricing.'),
  item('hypothesis', 'Energy', 'Maybe I focus better after lunch.'),
];
function envelope(proposals: readonly OwnerBaselineProposal[], messageId: string) {
  return {
    decisionType: 'capture',
    conversationResponse: {
      message: 'Already saved everything!',
      nextAction: null,
      tone: 'neutral',
    },
    reasoningSummary: {
      decisionSummary: 'Synthetic owner extraction',
      importantEvidenceIds: [],
      materialTradeoffs: [],
      confidenceBasisPoints: 9000,
      missingInformation: [],
    },
    evidence: [],
    clarification: null,
    proposedActions: [
      {
        actionType: 'finance.transfer',
        riskClass: 'HIGH_IMPACT',
        targetRecordId: null,
        title: null,
        scheduledFor: null,
        completionEvidenceId: null,
        planProposalReference: null,
        rationale: 'Synthetic untrusted action must never execute.',
        evidenceIds: [messageId],
      },
    ],
    memoryCandidates: proposals.map((proposal) => ({
      kind: proposal.kind === 'commitment' ? 'open_loop' : proposal.kind,
      normalizedStatement: JSON.stringify(proposal),
      authority: 'owner_review',
      evidenceIds: [messageId],
      confidenceBasisPoints: 10000,
      sensitivity: 'normal',
      validFrom: null,
      validTo: null,
      reviewAt: null,
      requiresOwnerConfirmation: false,
      relatedEntityIds: [],
    })),
    planProposal: null,
    reminderProposal: null,
    interventionProposal: null,
  };
}
async function fixture(channel: 'telegram' | 'whatsapp' = 'telegram') {
  if (!testUrl) throw new Error('A disposable local database is required.');
  const url = new URL(testUrl);
  if (
    !['localhost', '127.0.0.1', '::1', 'postgres'].includes(url.hostname) ||
    !url.pathname.includes('test')
  )
    throw new Error('Bootstrap tests never use production.');
  const runtime = createDatabaseRuntime({ connectionString: testUrl, maxConnections: 4 });
  runtimes.push(runtime);
  const db = runtime.db,
    ownerId = randomUUID(),
    conversationId = randomUUID(),
    connectionId = randomUUID();
  const ref = (kind: string) => `tg:${kind}:${ownerId.replaceAll('-', '').repeat(2)}`;
  const waRef = (kind: string) => `wa-cloud:${kind}:${ownerId.replaceAll('-', '').repeat(2)}`;
  await db.insert(owners).values({
    id: ownerId,
    emailNormalized: `${ownerId}@synthetic.invalid`,
    displayName: 'Synthetic bootstrap owner',
    timezone: 'America/Chicago',
  });
  await db.insert(conversations).values({
    id: conversationId,
    ownerId,
    channel,
    externalConversationId: channel === 'telegram' ? ref('conversation') : waRef('conversation'),
  });
  await db.insert(messagingTransportConnections).values({
    id: connectionId,
    ownerId,
    transport: 'telegram_bot',
    instanceReference: 'synthetic',
    outboundEnabled: true,
    versionVerified: true,
    state: 'connected',
  });
  await db.insert(messagingIdentityAliases).values({
    ownerId,
    connectionId,
    identityReference: ref('participant'),
    canonicalContactReference: `canonical-owner:${ownerId}`,
    identityKind: 'telegram_private_participant_v1',
    approved: true,
  });
  await db.insert(telegramBotParticipants).values({
    id: randomUUID(),
    ownerId,
    connectionId,
    participantReference: ref('participant'),
    conversationReference: ref('conversation'),
    providerChatId: '100001',
    lastObservedAt: new Date(),
  });
  const repository = new DrizzleBrainRepository(db),
    gateway = new FakeModelGateway();
  const contextAssembler = new ContextAssembler({
    maxContextRecords: 32,
    maxRecentMessages: 12,
    maxApproxPromptTokens: 6000,
  });
  const service = new ConversationTurnService({
    repository,
    gateway,
    contextAssembler,
    promptAssembler: new PromptAssembler(),
    actionPipeline: {
      store: new DrizzleTransactionalEventStore(db, new CanonicalOnlyDurableJobTransport()),
      policy: { evaluate: (action) => evaluatePolicy(action, { ownerAuthorized: true }) },
    },
    interventionService: new InterventionService({
      listHistory: async () => [],
      persistProposedRun: async () => {},
      recordOutcome: async () => {},
    }),
    deepEscalationEnabled: false,
    maxRecentMessages: 12,
  });
  async function input(message: string): Promise<ConversationTurnInput> {
    const eventId = randomUUID(),
      providerEventId = randomUUID(),
      messageId = randomUUID(),
      correlationId = randomUUID();
    const at = new Date();
    const payload =
      channel === 'telegram'
        ? {
            kind: 'telegram_bot_message_observed',
            transport: 'telegram_bot',
            conversationType: 'direct',
            conversationReference: ref('conversation'),
            providerUpdateReference: ref('update'),
            providerMessageReference: ref('message'),
            participantReference: ref('participant'),
            deliveryTargetReference: ref('conversation'),
            messageType: 'text',
            text: message,
          }
        : {
            kind: 'whatsapp_cloud_message_observed',
            transport: 'cloud_api',
            conversationType: 'direct',
            category: 'uncategorized',
            conversationReference: waRef('conversation'),
            providerMessageReference: waRef('message'),
            participantReference: waRef('participant'),
            ownerVerified: true,
            deliveryTargetReference: `wa-cloud:bridge-conversation:${conversationId}`,
            messageType: 'text',
            text: message,
            media: [],
          };
    await db.insert(events).values({
      id: eventId,
      ownerId,
      eventType:
        channel === 'telegram'
          ? 'telegram.bot.message.observed.v1'
          : 'whatsapp.cloud.message.observed.v1',
      source: channel,
      sourceEventId: providerEventId,
      idempotencyKey: `synthetic:${eventId}`,
      occurredAt: at,
      receivedAt: at,
      payload,
      payloadHash: 'synthetic',
      schemaVersion: 1,
      correlationId,
    });
    await db.insert(messages).values({
      id: messageId,
      ownerId,
      conversationId,
      channel,
      direction: 'inbound',
      content: message,
      occurredAt: at,
      receivedAt: at,
      sourceEventId: providerEventId,
      correlationId,
    });
    return {
      ownerId,
      conversationId,
      message,
      timestamp: at.toISOString(),
      idempotencyKey: `synthetic-owner-baseline:${eventId}`,
      correlationId,
      causationId: null,
      sourceEventId: eventId,
      messageId,
      inboundAlreadyPersisted: true,
      channel,
      channelMetadata: {
        ownerVerified: true,
        conversationType: 'direct',
        transport: channel === 'telegram' ? 'telegram_bot' : 'cloud_api',
      },
      currentState: {
        contextRecords: [],
        hardOverrideIds: [],
        availableData: [],
        existingPlanBlocks: [],
        availableDayPlanIds: [],
        hasConflict: false,
        highConsequence: false,
        remainingDeepCalls: 0,
        maximumModelCalls: 1,
      },
    };
  }
  async function accepted(responseMessageId: string) {
    await db
      .update(messages)
      .set({ deliveryState: 'accepted', updatedAt: new Date() })
      .where(and(eq(messages.id, responseMessageId), eq(messages.ownerId, ownerId)));
  }
  async function turn(message: string, proposals?: readonly OwnerBaselineProposal[]) {
    const turnInput = await input(message);
    if (proposals)
      gateway.enqueue({ kind: 'decision', decision: envelope(proposals, turnInput.messageId!) });
    const result = await service.process(turnInput);
    return { input: turnInput, result };
  }
  async function stage(proposals: readonly OwnerBaselineProposal[] = baseline) {
    const value = await turn(
      `My baseline:\n${proposals.map((p) => p.sourceQuote).join('\n')}`,
      proposals,
    );
    expect(value.result.status).toBe('completed');
    return value;
  }
  async function answer(message: string, reply = 'Synthetic ordinary answer.') {
    const turnInput = await input(message);
    gateway.enqueue({
      kind: 'decision',
      decision: {
        ...envelope([], turnInput.messageId!),
        proposedActions: [],
        decisionType: 'answer',
        conversationResponse: { message: reply, nextAction: null, tone: 'neutral' },
      },
    });
    return service.process(turnInput);
  }
  async function approve(proposals: readonly OwnerBaselineProposal[] = baseline) {
    const draft = await stage(proposals);
    await accepted(draft.result.responseMessageId!);
    const result = await turn('yes, save those');
    expect(result.result.conversationResponse?.message).toContain('Saved');
    return result;
  }
  async function review() {
    return repository.loadOwnerBaselineReview({
      ownerId,
      conversationId,
      now: new Date(Date.now() + 100000).toISOString(),
    });
  }
  return {
    db,
    repository,
    gateway,
    contextAssembler,
    service,
    ownerId,
    conversationId,
    connectionId,
    input,
    turn,
    accepted,
    stage,
    answer,
    approve,
    review,
  };
}

describe.skipIf(!testUrl)(
  'disposable owner bootstrap through the production Brain repository',
  () => {
    test('private canonical commitments remain scoped and restricted details cannot enter accountability guidance', async () => {
      const f = await fixture();
      await f.approve([
        item('commitment', 'Ozan', 'I will discuss Ozan’s private medical treatment next Tuesday.'),
        item('commitment', 'Mira', 'I will discuss Mira’s private diagnosis next Wednesday.', {
          sensitivity: 'restricted',
        }),
      ]);
      const generic = await f.repository.loadDailyUseState({
        ownerId: f.ownerId,
        now: new Date().toISOString(),
        ownerMessage: 'What should I do today?',
      });
      expect(generic.commitments).toHaveLength(0);
      expect(generic.records.filter((r) => r.recordType === 'commitment')).toHaveLength(0);
      await f.answer('What should I do today?');
      expect(f.gateway.requests.at(-1)!.input).not.toMatch(
        /Ozan|Mira|medical treatment|diagnosis/u,
      );
      const named = await f.repository.loadDailyUseState({
        ownerId: f.ownerId,
        now: new Date().toISOString(),
        ownerMessage: 'What are my commitments involving Ozan and Mira?',
      });
      expect(named.commitments).toHaveLength(1);
      expect(named.records.find((r) => r.content.includes('diagnosis'))?.sensitivity).toBe(
        'restricted',
      );
      await f.answer('What are my commitments involving Ozan and Mira?');
      expect(f.gateway.requests.at(-1)!.input).toContain('medical treatment');
      expect(f.gateway.requests.at(-1)!.input).not.toContain('diagnosis');
      const canonical = await f.db
        .select()
        .from(commitments)
        .where(eq(commitments.ownerId, f.ownerId));
      expect(canonical).toHaveLength(2);
      expect(canonical.every((row) => row.status === 'open')).toBe(true);
    });
    test('scoped answers cannot leak through later general history, even after the private commitment is corrected', async () => {
      const f = await fixture();
      await f.approve([
        item('person', 'Ozan', 'Ozan is my close friend and I value his practical advice.'),
        item('commitment', 'Ozan', 'I will discuss Ozan’s private medical treatment next Tuesday.'),
      ]);
      const privateReply = 'Ozan is your close friend; discuss his private medical treatment.';
      await f.answer('Tell me about Ozan.', privateReply);
      expect(f.gateway.requests.at(-1)!.input).toContain('medical treatment');
      await f.answer('What should I do today?');
      expect(f.gateway.requests.at(-1)!.input).not.toMatch(/Ozan|close friend|medical treatment/u);
      const changed = await f.turn('change 2 to I will draft the Atlas proposal next Tuesday.');
      await f.accepted(changed.result.responseMessageId!);
      await f.turn('yes, save those');
      await f.answer('What should I work on next?');
      expect(f.gateway.requests.at(-1)!.input).not.toMatch(/Ozan|close friend|medical treatment/u);
      const canonical = await f.db
        .select()
        .from(commitments)
        .where(eq(commitments.ownerId, f.ownerId));
      expect(canonical).toHaveLength(1);
      expect(canonical[0]?.title).toContain('Atlas proposal');
      // Wording corrections do not silently broaden previously private context.
      expect(canonical[0]?.metadata.personalContextName).toBe('Ozan');
    });
    test('identical statement proposals across kinds are rejected before a replayable staging intent exists', async () => {
      const f = await fixture();
      const values = [
        item('fact', 'Work style', 'I prefer concise answers.'),
        item('preference', 'Answers', 'I prefer concise answers.'),
      ];
      const result = await f.turn('My baseline: I prefer concise answers.', values);
      expect(result.result.status).toBe('invalid_model_output');
      await f.service.process(result.input);
      expect(f.gateway.requests).toHaveLength(1);
      expect(
        await f.db.select().from(memoryCandidates).where(eq(memoryCandidates.ownerId, f.ownerId)),
      ).toHaveLength(0);
    });
    test('explicit post-approval reclassification preserves the protected goal until new review confirmation', async () => {
      const f = await fixture();
      await f.approve([baseline[0]!]);
      const before = await f.review();
      const changed = await f.turn("that's not a goal 1");
      expect(
        (
          await f.db
            .select()
            .from(constitutionItems)
            .where(eq(constitutionItems.id, before!.items[0]!.constitutionItemId!))
        )[0]?.active,
      ).toBe(true);
      await f.accepted(changed.result.responseMessageId!);
      await f.turn('yes, save those');
      expect(
        (
          await f.db
            .select()
            .from(constitutionItems)
            .where(eq(constitutionItems.id, before!.items[0]!.constitutionItemId!))
        )[0]?.active,
      ).toBe(false);
      expect((await f.review())?.items[0]?.kind).toBe('observation');
      expect(
        await f.db.select().from(constitutionItems).where(eq(constitutionItems.ownerId, f.ownerId)),
      ).toHaveLength(1);
    });
    test('acceptance after the confirming inbound cannot retroactively authorize an unseen review', async () => {
      const f = await fixture();
      const staged = await f.stage([baseline[0]!]);
      const early = await f.input('yes, save those');
      await f.accepted(staged.result.responseMessageId!);
      const result = await f.service.process(early);
      expect(result.conversationResponse?.message).toContain('show you the current');
      expect(
        await f.db.select().from(constitutionItems).where(eq(constitutionItems.ownerId, f.ownerId)),
      ).toHaveLength(0);
      await f.accepted(result.responseMessageId!);
      expect((await f.turn('yes, save those')).result.conversationResponse?.message).toContain(
        'Saved 1',
      );
    });
    test('private source and reviews stay out of the next unrelated production Brain prompt, including reclassified private hypotheses and rules', async () => {
      const f = await fixture();
      await f.approve([
        item('person', 'Mira', 'Maybe Mira is my mentor.'),
        item(
          'relationship',
          'Ozan',
          'I always keep Ozan’s private relationship details confidential.',
        ),
      ]);
      const generic = await f.input('What should I do today?');
      f.gateway.enqueue({
        kind: 'decision',
        decision: {
          ...envelope([], generic.messageId!),
          proposedActions: [],
          decisionType: 'answer',
          conversationResponse: {
            message: 'Synthetic generic reply.',
            nextAction: null,
            tone: 'neutral',
          },
        },
      });
      await f.service.process(generic);
      const prompt = f.gateway.requests.at(-1)!;
      expect(prompt.input).not.toContain('Mira');
      expect(prompt.input).not.toContain('Ozan');
      expect(prompt.input).not.toContain('private relationship details');
      const named = await f.repository.loadDailyUseState({
        ownerId: f.ownerId,
        now: new Date(Date.now() + 1000).toISOString(),
        ownerMessage: 'What do I know about Mira and Ozan?',
      });
      expect(named.records.map((row) => row.recordType)).toEqual(
        expect.arrayContaining(['hypothesis', 'constitution']),
      );
      expect(named.records.find((row) => row.recordType === 'hypothesis')?.sensitivity).toBe(
        'sensitive',
      );
    });
    test('same-label conflicting extraction fails before staging and replay does not call the model again', async () => {
      const f = await fixture();
      const values = [
        item('preference', 'Answers', 'I prefer brief answers.'),
        item('preference', 'Answers', 'I prefer detailed answers.'),
      ];
      const result = await f.turn(
        `My baseline:\n${values.map((p) => p.sourceQuote).join('\n')}`,
        values,
      );
      expect(result.result.status).toBe('invalid_model_output');
      expect(
        await f.db.select().from(memoryCandidates).where(eq(memoryCandidates.ownerId, f.ownerId)),
      ).toHaveLength(0);
      await f.service.process(result.input);
      expect(f.gateway.requests).toHaveLength(1);
    });
    test('uses the same approval path for verified private WhatsApp without changing its transport', async () => {
      const f = await fixture('whatsapp');
      await f.approve([baseline[1]!, baseline[2]!]);
      expect(f.gateway.requests).toHaveLength(1);
      expect(
        await f.db.select().from(projects).where(eq(projects.ownerId, f.ownerId)),
      ).toHaveLength(1);
    });
    test('keeps model extraction draft-only, ignores action/success claims, then confirms canonical context without another model', async () => {
      const f = await fixture();
      const staged = await f.stage();
      expect(staged.result.actionIds).toEqual([]);
      expect(staged.result.conversationResponse?.message).toContain('baseline review');
      expect(
        await f.db.select().from(constitutionItems).where(eq(constitutionItems.ownerId, f.ownerId)),
      ).toHaveLength(0);
      expect(
        await f.db.select().from(memoryRecords).where(eq(memoryRecords.ownerId, f.ownerId)),
      ).toHaveLength(0);
      expect(
        await f.db
          .select()
          .from(constitutionProposals)
          .where(
            and(
              eq(constitutionProposals.ownerId, f.ownerId),
              eq(constitutionProposals.state, 'draft'),
            ),
          ),
      ).toHaveLength(1);
      await f.accepted(staged.result.responseMessageId!);
      const saved = await f.turn('yes, save those');
      expect(saved.result.conversationResponse?.message).toContain('Saved 8');
      expect(f.gateway.requests).toHaveLength(1);
      expect(
        await f.db.select().from(projects).where(eq(projects.ownerId, f.ownerId)),
      ).toHaveLength(1);
      expect(
        await f.db
          .select()
          .from(commitments)
          .where(and(eq(commitments.ownerId, f.ownerId), eq(commitments.status, 'open'))),
      ).toHaveLength(1);
      expect(
        await f.db.select().from(personalityTraits).where(eq(personalityTraits.ownerId, f.ownerId)),
      ).toHaveLength(0);
      expect(
        await f.db.select().from(reminders).where(eq(reminders.ownerId, f.ownerId)),
      ).toHaveLength(0);
      expect(await f.db.select().from(jobs).where(eq(jobs.ownerId, f.ownerId))).toHaveLength(0);
      const next = await f.input(
        'Give me a short take on Atlas today, keeping my proposal commitment and launch goal in mind.',
      );
      f.gateway.enqueue({
        kind: 'decision',
        decision: {
          ...envelope([], next.messageId!),
          decisionType: 'answer',
          proposedActions: [],
          conversationResponse: {
            message: 'Synthetic grounded reply.',
            nextAction: null,
            tone: 'neutral',
          },
        },
      });
      await f.service.process(next);
      const context = f.gateway.requests.at(-1)!.context;
      expect(context.records.map((row) => row.recordType)).toEqual(
        expect.arrayContaining(['constitution', 'owner_preference', 'project', 'commitment']),
      );
      expect(context.records.some((row) => row.recordType === 'person')).toBe(false);
      expect(context.manifest.promptTokenEstimate).toBeLessThanOrEqual(6000);
      expect(context.records).toHaveLength(context.manifest.selectedRecords.length);
      const canon = await f.review();
      expect(canon?.reviewed).toBe(true);
      const replay = await f.service.process(saved.input);
      expect(replay.status).toBe('duplicate');
      expect(replay.conversationResponse).toEqual(saved.result.conversationResponse);
      expect(f.gateway.requests).toHaveLength(2);
      expect(
        await f.db.select().from(projects).where(eq(projects.ownerId, f.ownerId)),
      ).toHaveLength(1);
    });
    test('never approves a local-only or superseded review; the latest shown revision is required', async () => {
      const f = await fixture();
      const staged = await f.stage(baseline.slice(0, 2));
      const unshown = await f.turn('yes, save those');
      expect(unshown.result.conversationResponse?.message).toContain('show you the current');
      expect(
        await f.db.select().from(constitutionItems).where(eq(constitutionItems.ownerId, f.ownerId)),
      ).toHaveLength(0);
      await f.accepted(staged.result.responseMessageId!);
      const changed = await f.turn('change 2 to I prefer two sentences.');
      const stale = await f.turn('yes, save those');
      expect(stale.result.conversationResponse?.message).toContain('show you the current');
      await f.accepted(changed.result.responseMessageId!);
      const saved = await f.turn('yes, save those');
      expect(saved.result.conversationResponse?.message).toContain('Saved 2');
      expect(f.gateway.requests).toHaveLength(1);
    });
    test('uses natural ambiguous correction, numbered exclusion, not-goal reclassification and explicit temporary expiry without duplicates', async () => {
      const f = await fixture();
      await f.stage(baseline.slice(0, 3));
      const ambiguous = await f.turn('not that one');
      expect(ambiguous.result.conversationResponse?.message).toContain('Which item number');
      await f.turn('3');
      expect((await f.review())?.items[2]?.excluded).toBe(true);
      await f.turn("that's not a goal 1");
      expect((await f.review())?.items[0]?.kind).toBe('observation');
      const temporary = await f.turn("that's temporary 2");
      expect(temporary.result.conversationResponse?.message).toContain('Until when');
      const blocked = await f.turn('yes, save those');
      expect(blocked.result.conversationResponse?.message).not.toContain('Saved');
      const dated = await f.turn('temporary 2 until 2027-01-10');
      await f.accepted(dated.result.responseMessageId!);
      await f.turn('yes, save those');
      expect(
        await f.db.select().from(constitutionItems).where(eq(constitutionItems.ownerId, f.ownerId)),
      ).toHaveLength(0);
      expect(
        await f.db.select().from(projects).where(eq(projects.ownerId, f.ownerId)),
      ).toHaveLength(0);
      expect(
        await f.db.select().from(preferences).where(eq(preferences.ownerId, f.ownerId)),
      ).toHaveLength(1);
      expect(
        await f.db.select().from(onboardingAnswers).where(eq(onboardingAnswers.ownerId, f.ownerId)),
      ).toHaveLength(4);
      expect(
        await f.db
          .select()
          .from(memoryEvidence)
          .where(
            and(
              eq(memoryEvidence.ownerId, f.ownerId),
              eq(memoryEvidence.evidenceType, 'owner_baseline_correction'),
            ),
          ),
      ).toHaveLength(3);
      const late = await f.repository.loadDailyUseState({
        ownerId: f.ownerId,
        now: '2027-02-01T12:00:00Z',
        ownerMessage: 'Short answers?',
      });
      expect(late.records.some((row) => row.recordType === 'owner_preference')).toBe(false);
    });
    test('revises an approved project in place and requires fresh consent before replacing an active goal version', async () => {
      const f = await fixture();
      await f.approve([baseline[0]!, baseline[2]!]);
      const before = await f.review();
      const id = before!.items[0]!.constitutionItemId;
      await f.turn('change 1 to Launch Atlas in six months.');
      expect(
        (
          await f.db
            .select()
            .from(constitutionItemVersions)
            .where(
              and(
                eq(constitutionItemVersions.constitutionItemId, id!),
                eq(constitutionItemVersions.isCurrent, true),
              ),
            )
        )[0]?.principle,
      ).toContain('12 months');
      const changed = await f.turn('change 2 to Atlas now focuses on solo founders.');
      await f.accepted(changed.result.responseMessageId!);
      await f.turn('yes, save those');
      const after = await f.review();
      expect(after!.items[0]!.constitutionItemId).toBe(id);
      expect(after!.items[1]!.entityId).toBe(before!.items[1]!.entityId);
      expect(
        await f.db.select().from(projects).where(eq(projects.ownerId, f.ownerId)),
      ).toHaveLength(1);
      expect(
        await f.db.select().from(constitutionItems).where(eq(constitutionItems.ownerId, f.ownerId)),
      ).toHaveLength(1);
      expect(
        await f.db
          .select()
          .from(constitutionItemVersions)
          .where(
            and(
              eq(constitutionItemVersions.constitutionItemId, id!),
              eq(constitutionItemVersions.isCurrent, true),
            ),
          ),
      ).toHaveLength(1);
      const oldMemory = before!.items[1]!.acceptedMemoryRecordId;
      expect(
        (await f.db.select().from(memoryRecords).where(eq(memoryRecords.id, oldMemory!)))[0],
      ).toMatchObject({
        active: false,
        supersededByMemoryRecordId: after!.items[1]!.acceptedMemoryRecordId,
      });
    });
    test('rolls back partial promotion/reply and recovers staged confirmation without a new model call', async () => {
      const f = await fixture();
      const staged = await f.stage([baseline[0]!, baseline[3]!]);
      await f.accepted(staged.result.responseMessageId!);
      const confirmation = await f.input('yes, save those');
      const fail = vi
        .spyOn(DrizzleTransactionalEventStore.prototype, 'transaction')
        .mockRejectedValueOnce(new Error('Synthetic internal action failure'));
      await expect(f.service.process(confirmation)).rejects.toThrow(
        'Synthetic internal action failure',
      );
      fail.mockRestore();
      expect(
        await f.db.select().from(constitutionItems).where(eq(constitutionItems.ownerId, f.ownerId)),
      ).toHaveLength(0);
      expect(
        await f.db.select().from(memoryRecords).where(eq(memoryRecords.ownerId, f.ownerId)),
      ).toHaveLength(0);
      const replay = await f.service.process(confirmation);
      expect(replay.conversationResponse?.message).toContain('Saved 2');
      expect(f.gateway.requests).toHaveLength(1);
      expect(
        await f.db.select().from(commitments).where(eq(commitments.ownerId, f.ownerId)),
      ).toHaveLength(1);
    });
    test('rereads exact owner enrollment before canonical approval', async () => {
      const f = await fixture();
      const staged = await f.stage([baseline[0]!]);
      await f.accepted(staged.result.responseMessageId!);
      await f.db
        .update(messagingIdentityAliases)
        .set({ approved: false })
        .where(eq(messagingIdentityAliases.ownerId, f.ownerId));
      await expect(f.turn('yes, save those')).rejects.toThrow('current exact owner');
      expect(
        await f.db.select().from(constitutionItems).where(eq(constitutionItems.ownerId, f.ownerId)),
      ).toHaveLength(0);
    });
    test('does not publish relationship material broadly; named owner context selects it and restricted summaries are redacted', async () => {
      const f = await fixture();
      await f.approve([
        baseline[4]!,
        item(
          'relationship',
          'Ozan',
          'Ozan is a close friend; this relationship summary is private.',
          { sensitivity: 'restricted' },
        ),
      ]);
      const generic = await f.repository.loadDailyUseState({
        ownerId: f.ownerId,
        now: new Date(Date.now() + 100000).toISOString(),
        ownerMessage: 'What should I do today?',
      });
      expect(
        generic.records.some((row) => ['person', 'relationship'].includes(row.recordType)),
      ).toBe(false);
      const named = await f.repository.loadDailyUseState({
        ownerId: f.ownerId,
        now: new Date(Date.now() + 100000).toISOString(),
        ownerMessage: 'Give me a take on Mira and Ozan.',
      });
      expect(named.records.map((row) => row.recordType)).toEqual(
        expect.arrayContaining(['person', 'relationship']),
      );
      const request = (await f.gateway.requests[0])!.request;
      const assembled = f.contextAssembler.assemble({
        request,
        now: new Date(Date.now() + 100000).toISOString(),
        records: named.records,
        hardOverrideIds: [],
        availableData: [],
      });
      expect(JSON.stringify(assembled.records)).not.toContain('close friend');
      expect(assembled.manifest.selectedRecords.some((row) => row.redactedForModel)).toBe(true);
    });
    test('serializes two approvals and preserves one canonical entity and one activation', async () => {
      const f = await fixture();
      const staged = await f.stage(baseline.slice(0, 4));
      await f.accepted(staged.result.responseMessageId!);
      const a = await f.input('yes, save those'),
        b = await f.input('yes, save those');
      await Promise.all([f.service.process(a), f.service.process(b)]);
      expect(
        await f.db.select().from(projects).where(eq(projects.ownerId, f.ownerId)),
      ).toHaveLength(1);
      expect(
        await f.db.select().from(commitments).where(eq(commitments.ownerId, f.ownerId)),
      ).toHaveLength(1);
      expect(
        await f.db
          .select()
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.ownerId, f.ownerId),
              eq(auditEvents.action, 'owner_baseline.constitution.confirmed'),
            ),
          ),
      ).toHaveLength(1);
    });
    test('leaves groups and non-owner turns outside baseline capture and approval', async () => {
      const f = await fixture();
      const input = await f.input('My baseline: I prefer concise answers.');
      f.gateway.enqueue({
        kind: 'decision',
        decision: {
          ...envelope([], input.messageId!),
          proposedActions: [],
          conversationResponse: {
            message: 'Synthetic ordinary answer.',
            nextAction: null,
            tone: 'neutral',
          },
        },
      });
      await f.service.process({
        ...input,
        channelMetadata: {
          ownerVerified: false,
          conversationType: 'group',
          transport: 'telegram_bot',
        },
      });
      expect(f.gateway.requests[0]?.instructions).not.toContain('owner-baseline-drafts');
      expect(await f.review()).toBeNull();
    });
    test('fails invalid extraction without creating candidates or claiming saved state', async () => {
      const f = await fixture();
      const input = await f.input('My baseline: I prefer concise answers.');
      f.gateway.enqueue({
        kind: 'decision',
        decision: envelope(
          [{ ...baseline[1]!, sourceQuote: 'Invented previous history' }],
          input.messageId!,
        ),
      });
      const result = await f.service.process(input);
      expect(result.status).toBe('invalid_model_output');
      expect(result.conversationResponse?.message).not.toContain('Saved');
      expect(
        await f.db.select().from(memoryCandidates).where(eq(memoryCandidates.ownerId, f.ownerId)),
      ).toHaveLength(0);
    });
  },
);
