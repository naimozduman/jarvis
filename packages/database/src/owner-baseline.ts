import { createHash } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
  conversationResponseSchema,
  canonicalJson,
  ownerBaselineItemSchema,
  ownerBaselineOperationSchema,
  evaluateMemoryPromotion,
  telegramBotCanonicalPayloadSchema,
  whatsappCloudCanonicalPayloadSchema,
  type ConversationResponse,
  type OwnerBaselineItem,
  type OwnerBaselineReview,
  type OwnerBaselineProposal,
} from '@jarvis/contracts';
import { processProposedAction } from '@jarvis/domain';
import { evaluatePolicy } from '@jarvis/security';
import type { JarvisDatabase } from './client.js';
import { DrizzleTransactionalEventStore } from './event-store.js';
import { CanonicalOnlyDurableJobTransport } from './jobs.js';
import {
  auditEvents,
  brainDecisions,
  brainRequests,
  messages,
  conversations,
  events,
  owners,
  messagingIdentityAliases,
  telegramBotParticipants,
  onboardingQuestionnaires,
  onboardingAnswers,
  memoryCandidates,
  memoryEvidence,
  memoryRecords,
  constitutionProposals,
  constitutionItems,
  constitutionItemVersions,
  facts,
  preferences,
  people,
  relationships,
  projects,
  observations,
  hypotheses,
  openLoops,
  commitments,
} from './schema/index.js';

type Transaction = Parameters<Parameters<JarvisDatabase['transaction']>[0]>[0];
type Reader = JarvisDatabase | Transaction;
const version = 'owner-baseline-v1';
const source = 'owner_bootstrap';
export function ownerBaselineId(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function ownerBaselineQuestionnaireId(ownerId: string, conversationId: string): string {
  return ownerBaselineId(`${version}:${ownerId}:${conversationId}`);
}
function revision(items: readonly OwnerBaselineItem[]): string {
  return createHash('sha256').update(canonicalJson({ items })).digest('hex');
}
function memoryKind(item: OwnerBaselineProposal) {
  return item.kind === 'commitment' ? ('open_loop' as const) : item.kind;
}
function proposalValue(item: OwnerBaselineProposal): OwnerBaselineProposal {
  return {
    kind: item.kind,
    title: item.title,
    statement: item.statement,
    sourceQuote: item.sourceQuote,
    confidenceBasisPoints: item.confidenceBasisPoints,
    sensitivity: item.sensitivity,
    temporary: item.temporary,
    validUntil: item.validUntil,
    personalContextName: item.personalContextName,
  };
}
const labels: Record<OwnerBaselineItem['kind'], string> = {
  constitution_candidate: 'goal / standing rule',
  fact: 'fact',
  preference: 'preference',
  person: 'person (private)',
  relationship: 'relationship (private)',
  project: 'project',
  open_loop: 'open loop',
  commitment: 'commitment',
  observation: 'observation',
  hypothesis: 'hypothesis',
};
function reviewText(items: readonly OwnerBaselineItem[]): string {
  if (!items.length)
    return 'Send “My baseline:” followed by your main goals/rules, current projects, communication preferences and near-term commitments. Include only the people or details you want me to remember. I’ll show a numbered draft for your review before saving it.';
  return `Here’s your baseline review:\n${items.map((item) => `${item.ordinal}. [${item.excluded ? 'excluded' : labels[item.kind]}${item.temporary ? `; temporary${item.validUntil ? ` through ${item.validUntil}` : ', expiry needed'}` : ''}] ${item.title}: ${item.statement}`).join('\n')}\n\nSay “yes, save those” to confirm this version. To correct it: “not that one 2”, “change 2 to …”, “temporary 2 until YYYY-MM-DD”, or “not a goal 2”. Existing goals and commitments stay unchanged until confirmation; excluding an existing commitment from this baseline does not cancel it.`;
}

/** Current review lives in canonical onboarding answers; candidates and typed records remain canonical. */
export async function loadOwnerBaselineReview(
  database: Reader,
  input: { ownerId: string; conversationId: string; now: string },
): Promise<OwnerBaselineReview | null> {
  const id = ownerBaselineQuestionnaireId(input.ownerId, input.conversationId);
  const [questionnaire] = await database
    .select()
    .from(onboardingQuestionnaires)
    .where(
      and(
        eq(onboardingQuestionnaires.id, id),
        eq(onboardingQuestionnaires.ownerId, input.ownerId),
        eq(onboardingQuestionnaires.version, version),
        eq(onboardingQuestionnaires.source, `${source}:${input.conversationId}`),
      ),
    )
    .limit(1);
  if (!questionnaire) return null;
  const answers = await database
    .select()
    .from(onboardingAnswers)
    .where(
      and(eq(onboardingAnswers.questionnaireId, id), eq(onboardingAnswers.ownerId, input.ownerId)),
    );
  const items = answers
    .filter((row) => row.questionId.startsWith('baseline.item.'))
    .map((row) => ownerBaselineItemSchema.parse(JSON.parse(row.value ?? 'null')))
    .sort((a, b) => a.ordinal - b.ordinal);
  const control = answers.find((row) => row.questionId === 'baseline.pending_correction');
  const pending = ownerBaselineOperationSchema.shape.pendingCorrection.parse(
    control?.value ? JSON.parse(control.value) : null,
  );
  // Only a review accepted by the provider, in this same conversation, can bind a later approval.
  const views = await database
    .select({ result: brainDecisions.executionResult })
    .from(brainDecisions)
    .innerJoin(
      brainRequests,
      and(
        eq(brainRequests.id, brainDecisions.brainRequestId),
        eq(brainRequests.ownerId, brainDecisions.ownerId),
      ),
    )
    .innerJoin(
      messages,
      and(
        eq(messages.ownerId, brainRequests.ownerId),
        eq(messages.conversationId, brainRequests.conversationId),
        sql`${messages.id}::text = ${brainDecisions.executionResult}->>'responseMessageId'`,
      ),
    )
    .where(
      and(
        eq(brainRequests.ownerId, input.ownerId),
        eq(brainRequests.conversationId, input.conversationId),
        eq(messages.direction, 'outbound'),
        sql`((${messages.deliveryState} in ('sent','delivered','read','accepted') and ${messages.updatedAt} <= ${new Date(input.now)}) or exists(select 1 from jarvis.outbound_message_deliveries d where d.owner_id = ${input.ownerId}::uuid and d.message_id = ${messages.id} and d.accepted_at is not null and d.accepted_at <= ${new Date(input.now)}))`,
        sql`${messages.occurredAt} < ${new Date(input.now)}`,
        sql`${messages.occurredAt} > ${new Date(Date.parse(input.now) - 86_400_000)}`,
      ),
    )
    .orderBy(desc(messages.occurredAt), desc(messages.id))
    .limit(1);
  const marker = (
    views[0]?.result.ownerBaselineFinalization === 1
      ? views[0].result.ownerBaselineReview
      : undefined
  ) as { questionnaireId?: string; revision?: string } | undefined;
  return {
    questionnaireId: id,
    revision: revision(items),
    items,
    reviewed: questionnaire.state === 'accepted',
    presentedRevision: marker?.questionnaireId === id ? (marker.revision ?? null) : null,
    pendingCorrection: pending,
  };
}

async function assertCanonicalOwner(
  database: Reader,
  request: typeof brainRequests.$inferSelect,
  inbound: typeof messages.$inferSelect,
) {
  const [owner] = await database
    .select({ id: owners.id })
    .from(owners)
    .where(and(eq(owners.id, request.ownerId), eq(owners.status, 'active')))
    .limit(1);
  const [conversation] = await database
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, request.conversationId!),
        eq(conversations.ownerId, request.ownerId),
        eq(conversations.channel, inbound.channel),
        eq(conversations.state, 'active'),
      ),
    )
    .limit(1);
  const [event] = request.sourceEventId
    ? await database
        .select()
        .from(events)
        .where(and(eq(events.id, request.sourceEventId), eq(events.ownerId, request.ownerId)))
        .limit(1)
    : [];
  if (!owner || !conversation || !event || !inbound.content)
    throw new Error('Baseline review requires an active canonical private owner conversation.');
  const telegram = telegramBotCanonicalPayloadSchema.safeParse(event.payload);
  if (
    inbound.channel === 'telegram' &&
    event.source === 'telegram' &&
    event.eventType === 'telegram.bot.message.observed.v1' &&
    telegram.success &&
    telegram.data.text === inbound.content &&
    telegram.data.conversationReference === conversation.externalConversationId
  ) {
    const aliases = await database
      .select({ id: messagingIdentityAliases.id })
      .from(messagingIdentityAliases)
      .innerJoin(
        telegramBotParticipants,
        and(
          eq(telegramBotParticipants.ownerId, messagingIdentityAliases.ownerId),
          eq(telegramBotParticipants.connectionId, messagingIdentityAliases.connectionId),
          eq(
            telegramBotParticipants.participantReference,
            messagingIdentityAliases.identityReference,
          ),
        ),
      )
      .where(
        and(
          eq(messagingIdentityAliases.ownerId, request.ownerId),
          eq(messagingIdentityAliases.approved, true),
          eq(messagingIdentityAliases.identityKind, 'telegram_private_participant_v1'),
          eq(
            messagingIdentityAliases.canonicalContactReference,
            `canonical-owner:${request.ownerId}`,
          ),
          eq(messagingIdentityAliases.identityReference, telegram.data.participantReference),
          eq(telegramBotParticipants.conversationReference, telegram.data.conversationReference),
        ),
      )
      .limit(2)
      .for('share');
    if (aliases.length === 1) return;
  }
  const whatsapp = whatsappCloudCanonicalPayloadSchema.safeParse(event.payload);
  if (
    inbound.channel === 'whatsapp' &&
    event.source === 'whatsapp' &&
    event.eventType === 'whatsapp.cloud.message.observed.v1' &&
    whatsapp.success &&
    whatsapp.data.ownerVerified &&
    whatsapp.data.messageType === 'text' &&
    whatsapp.data.text === inbound.content &&
    whatsapp.data.conversationReference === conversation.externalConversationId
  )
    return;
  throw new Error('Baseline review requires current exact owner authorization.');
}

async function writeAnswer(
  database: Reader,
  ownerId: string,
  questionnaireId: string,
  questionId: string,
  value: unknown,
  state: string,
  now: Date,
) {
  await database
    .insert(onboardingAnswers)
    .values({
      id: ownerBaselineId(`${questionnaireId}:${questionId}`),
      ownerId,
      questionnaireId,
      questionId,
      value: JSON.stringify(value),
      state,
      source,
      reviewedAt: state === 'accepted' ? now : null,
    })
    .onConflictDoUpdate({
      target: [onboardingAnswers.questionnaireId, onboardingAnswers.questionId],
      set: {
        value: JSON.stringify(value),
        state,
        reviewedAt: state === 'accepted' ? now : null,
        updatedAt: now,
      },
      setWhere: eq(onboardingAnswers.ownerId, ownerId),
    });
}

interface Turn {
  request: typeof brainRequests.$inferSelect;
  inbound: typeof messages.$inferSelect;
  decisionId: string;
  now: Date;
}
async function audit(
  database: Reader,
  turn: Turn,
  action: string,
  itemId: string,
  metadata: Record<string, unknown> = {},
) {
  await database
    .insert(auditEvents)
    .values({
      id: ownerBaselineId(`${turn.request.id}:${action}:${itemId}`),
      ownerId: turn.request.ownerId,
      actorType: 'owner',
      actorId: turn.request.ownerId,
      action,
      targetType: 'owner_baseline',
      targetId: itemId,
      occurredAt: turn.now,
      correlationId: turn.request.correlationId,
      source,
      reason: 'Deliberate owner-authored baseline review; authority unchanged.',
      metadata: { sourceMessageId: turn.inbound.id, decisionId: turn.decisionId, ...metadata },
    })
    .onConflictDoNothing();
}
async function stageCandidate(
  database: Reader,
  turn: Turn,
  proposal: OwnerBaselineProposal,
  ordinal: number,
  previous?: OwnerBaselineItem,
): Promise<OwnerBaselineItem> {
  proposal = proposalValue(proposal);
  const candidateId = ownerBaselineId(`${turn.request.id}:candidate:${ordinal}`);
  const item: OwnerBaselineItem = {
    ...proposal,
    ordinal,
    candidateId,
    excluded: false,
    acceptedMemoryRecordId: previous?.acceptedMemoryRecordId ?? null,
    constitutionItemId: previous?.constitutionItemId ?? null,
    entityId: previous?.kind === proposal.kind ? previous.entityId : null,
  };
  if (previous) {
    await database
      .update(memoryCandidates)
      .set({ state: 'superseded', updatedAt: turn.now })
      .where(
        and(
          eq(memoryCandidates.id, previous.candidateId),
          eq(memoryCandidates.ownerId, turn.request.ownerId),
        ),
      );
    await database
      .update(constitutionProposals)
      .set({ state: 'superseded', updatedAt: turn.now })
      .where(
        and(
          eq(constitutionProposals.id, previous.candidateId),
          eq(constitutionProposals.ownerId, turn.request.ownerId),
          eq(constitutionProposals.state, 'draft'),
        ),
      );
  }
  await database.insert(memoryCandidates).values({
    id: candidateId,
    ownerId: turn.request.ownerId,
    kind: memoryKind(item),
    normalizedStatement: JSON.stringify(proposal),
    authority: 'explicit_owner_statement',
    sourceEventId: turn.request.sourceEventId,
    sourceMessageId: turn.inbound.id,
    sourceBrainDecisionId: turn.decisionId,
    confidenceBasisPoints: item.confidenceBasisPoints,
    sensitivity: item.sensitivity,
    validFrom: turn.now,
    validTo: item.validUntil ? new Date(item.validUntil) : null,
    requiresOwnerConfirmation: true,
    state: 'pending_review',
    relatedEntityIds: [item.entityId, item.constitutionItemId].filter((id): id is string =>
      Boolean(id),
    ),
  });
  await database.insert(memoryEvidence).values({
    id: ownerBaselineId(`${candidateId}:source`),
    ownerId: turn.request.ownerId,
    memoryCandidateId: candidateId,
    evidenceRecordId: turn.inbound.id,
    evidenceType: previous ? 'owner_baseline_correction' : 'owner_baseline_statement',
    authority: 'explicit_owner_statement',
    observedAt: turn.now,
  });
  if (item.kind === 'constitution_candidate')
    await database.insert(constitutionProposals).values({
      id: candidateId,
      ownerId: turn.request.ownerId,
      constitutionItemId: item.constitutionItemId,
      sourceBrainDecisionId: turn.decisionId,
      category: 'owner_baseline',
      principle: item.statement,
      priority: 80,
      flexibility: 'fixed',
      state: 'draft',
      proposedBy: 'owner_authored_model_proposal',
      correlationId: turn.request.correlationId,
    });
  await audit(
    database,
    turn,
    previous ? 'owner_baseline.candidate.corrected' : 'owner_baseline.candidate.drafted',
    candidateId,
    {
      priorCandidateId: previous?.candidateId ?? null,
      kind: item.kind,
      sensitivity: item.sensitivity,
    },
  );
  return item;
}

async function assertOwnedLinks(database: Reader, ownerId: string, item: OwnerBaselineItem) {
  const [candidate] = await database
    .select()
    .from(memoryCandidates)
    .where(and(eq(memoryCandidates.id, item.candidateId), eq(memoryCandidates.ownerId, ownerId)))
    .limit(1);
  if (!candidate || !['pending_review', 'confirmed', 'rejected'].includes(candidate.state))
    throw new Error('Baseline candidate is missing, foreign or superseded.');
  if (item.acceptedMemoryRecordId) {
    const [record] = await database
      .select({ id: memoryRecords.id })
      .from(memoryRecords)
      .where(
        and(eq(memoryRecords.id, item.acceptedMemoryRecordId), eq(memoryRecords.ownerId, ownerId)),
      )
      .limit(1);
    if (!record) throw new Error('Baseline memory link is not owner-scoped.');
  }
  if (item.constitutionItemId) {
    const [constitution] = await database
      .select({ id: constitutionItems.id })
      .from(constitutionItems)
      .where(
        and(
          eq(constitutionItems.id, item.constitutionItemId),
          eq(constitutionItems.ownerId, ownerId),
        ),
      )
      .limit(1);
    if (!constitution) throw new Error('Baseline constitution link is not owner-scoped.');
  }
  if (item.entityId) {
    const table =
      item.kind === 'commitment'
        ? commitments
        : item.kind === 'project'
          ? projects
          : item.kind === 'person'
            ? people
            : item.kind === 'relationship'
              ? relationships
              : item.kind === 'open_loop'
                ? openLoops
                : null;
    if (table) {
      const [entity] = await database
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.id, item.entityId), eq(table.ownerId, ownerId)))
        .limit(1);
      if (!entity) throw new Error('Baseline entity link is not owner-scoped.');
    }
  }
  return candidate;
}

async function approveItem(
  database: Transaction,
  turn: Turn,
  item: OwnerBaselineItem,
): Promise<OwnerBaselineItem> {
  const ownerId = turn.request.ownerId;
  const candidate = await assertOwnedLinks(database, ownerId, item);
  if (candidate.state === 'confirmed' && !item.excluded) return item;
  if (item.excluded) {
    if (item.constitutionItemId) {
      await database
        .update(constitutionItems)
        .set({ active: false, updatedAt: turn.now })
        .where(
          and(
            eq(constitutionItems.id, item.constitutionItemId),
            eq(constitutionItems.ownerId, ownerId),
          ),
        );
      await database
        .update(constitutionItemVersions)
        .set({ active: false, updatedAt: turn.now })
        .where(
          and(
            eq(constitutionItemVersions.constitutionItemId, item.constitutionItemId),
            eq(constitutionItemVersions.ownerId, ownerId),
            eq(constitutionItemVersions.isCurrent, true),
          ),
        );
    }
    if (item.acceptedMemoryRecordId)
      await database
        .update(memoryRecords)
        .set({
          active: false,
          negativeEvidenceCount: sql`${memoryRecords.negativeEvidenceCount} + 1`,
          updatedAt: turn.now,
        })
        .where(
          and(
            eq(memoryRecords.id, item.acceptedMemoryRecordId),
            eq(memoryRecords.ownerId, ownerId),
          ),
        );
    await database
      .update(memoryCandidates)
      .set({
        state: 'rejected',
        reviewedAt: turn.now,
        reviewedByOwnerId: ownerId,
        updatedAt: turn.now,
      })
      .where(and(eq(memoryCandidates.id, item.candidateId), eq(memoryCandidates.ownerId, ownerId)));
    await database
      .update(constitutionProposals)
      .set({
        state: 'rejected',
        reviewedAt: turn.now,
        reviewedByOwnerId: ownerId,
        updatedAt: turn.now,
      })
      .where(
        and(
          eq(constitutionProposals.id, item.candidateId),
          eq(constitutionProposals.ownerId, ownerId),
        ),
      );
    await audit(database, turn, 'owner_baseline.item.excluded', item.candidateId, {
      commitmentPreserved: item.kind === 'commitment',
    });
    return item;
  }
  if (candidate.state !== 'pending_review')
    throw new Error('A rejected candidate cannot be silently promoted.');
  if (item.temporary && (!item.validUntil || Date.parse(item.validUntil) <= turn.now.getTime()))
    throw new Error('Temporary baseline items require a future explicit expiry.');
  if (item.kind === 'constitution_candidate') {
    const id = item.constitutionItemId ?? ownerBaselineId(`${item.candidateId}:constitution`);
    const [existing] = await database
      .select()
      .from(constitutionItems)
      .where(and(eq(constitutionItems.id, id), eq(constitutionItems.ownerId, ownerId)))
      .limit(1);
    const nextVersion = existing ? existing.currentVersion + 1 : 1;
    if (existing)
      await database
        .update(constitutionItemVersions)
        .set({ active: false, isCurrent: false, updatedAt: turn.now })
        .where(
          and(
            eq(constitutionItemVersions.constitutionItemId, id),
            eq(constitutionItemVersions.ownerId, ownerId),
            eq(constitutionItemVersions.isCurrent, true),
          ),
        );
    else
      await database
        .insert(constitutionItems)
        .values({ id, ownerId, category: 'owner_baseline', active: false, currentVersion: 1 });
    await database.insert(constitutionItemVersions).values({
      id: ownerBaselineId(`${item.candidateId}:constitution-version`),
      ownerId,
      constitutionItemId: id,
      version: nextVersion,
      principle: item.statement,
      priority: 80,
      flexibility: 'fixed',
      source: 'owner_review',
      active: true,
      isCurrent: true,
      exceptions: [
        {
          ownerBaseline: 1,
          sensitivity: item.sensitivity,
          personalContextName: item.personalContextName,
          validUntil: item.validUntil,
          temporary: item.temporary,
        },
      ],
      changeReason: `Explicit private owner confirmation ${turn.inbound.id}`,
    });
    await database
      .update(constitutionItems)
      .set({ active: true, currentVersion: nextVersion, updatedAt: turn.now })
      .where(and(eq(constitutionItems.id, id), eq(constitutionItems.ownerId, ownerId)));
    await database
      .update(constitutionProposals)
      .set({
        state: 'accepted',
        constitutionItemId: id,
        reviewedAt: turn.now,
        reviewedByOwnerId: ownerId,
        updatedAt: turn.now,
      })
      .where(
        and(
          eq(constitutionProposals.id, item.candidateId),
          eq(constitutionProposals.ownerId, ownerId),
          eq(constitutionProposals.state, 'draft'),
        ),
      );
    await database
      .update(memoryCandidates)
      .set({
        state: 'confirmed',
        reviewedAt: turn.now,
        reviewedByOwnerId: ownerId,
        updatedAt: turn.now,
      })
      .where(and(eq(memoryCandidates.id, item.candidateId), eq(memoryCandidates.ownerId, ownerId)));
    await audit(database, turn, 'owner_baseline.constitution.confirmed', id, {
      version: nextVersion,
      candidateId: item.candidateId,
    });
    await database.insert(memoryEvidence).values({
      id: ownerBaselineId(`${turn.request.id}:${item.candidateId}:confirmation`),
      ownerId,
      memoryCandidateId: item.candidateId,
      evidenceRecordId: turn.inbound.id,
      evidenceType: 'owner_baseline_confirmation',
      authority: 'owner_review',
      observedAt: turn.now,
    });
    return { ...item, constitutionItemId: id };
  }
  const policy = evaluateMemoryPromotion({
    kind: memoryKind(item),
    authority: 'owner_review',
    evidenceIds: [candidate.sourceMessageId!, turn.inbound.id],
    requiresOwnerConfirmation: false,
  });
  // Reviewed hypotheses stay hypotheses; confirmation never turns uncertainty into a fact.
  if (!policy.mayBecomeDurableRecord && policy.effectiveKind !== 'hypothesis')
    throw new Error('Memory promotion policy rejected a baseline candidate.');
  if (policy.effectiveKind === 'constitution_candidate')
    throw new Error('Constitution proposals cannot enter durable memory.');
  const recordId = ownerBaselineId(`${item.candidateId}:approved-memory`);
  const entityId = item.entityId ?? ownerBaselineId(`${item.candidateId}:entity`);
  await database.insert(memoryRecords).values({
    id: recordId,
    ownerId,
    kind: policy.effectiveKind,
    source,
    sourceEventId: candidate.sourceEventId,
    confidenceBasisPoints: item.confidenceBasisPoints,
    sensitivity: item.sensitivity,
    validFrom: turn.now,
    validTo: item.validUntil ? new Date(item.validUntil) : null,
    reviewAt: item.validUntil ? new Date(item.validUntil) : null,
    reviewedAt: turn.now,
    evidenceCount: 2,
    positiveEvidenceCount: 2,
    active: true,
    relatedEntityIds: [entityId],
    metadata: {
      ownerBaseline: 1,
      title: item.title,
      statement: item.statement,
      candidateId: item.candidateId,
      sourceMessageId: candidate.sourceMessageId,
      confirmationMessageId: turn.inbound.id,
      personalContextScope: item.personalContextName
        ? 'named_owner_request_only'
        : 'owner_private_conversation',
      personalContextName: item.personalContextName,
    },
  });
  if (item.acceptedMemoryRecordId)
    await database
      .update(memoryRecords)
      .set({
        active: false,
        supersededByMemoryRecordId: recordId,
        negativeEvidenceCount: sql`${memoryRecords.negativeEvidenceCount} + 1`,
        updatedAt: turn.now,
      })
      .where(
        and(eq(memoryRecords.id, item.acceptedMemoryRecordId), eq(memoryRecords.ownerId, ownerId)),
      );
  if (item.constitutionItemId) {
    // Reclassification of a previously approved goal is applied only by this explicit review.
    await database
      .update(constitutionItems)
      .set({ active: false, updatedAt: turn.now })
      .where(
        and(
          eq(constitutionItems.id, item.constitutionItemId),
          eq(constitutionItems.ownerId, ownerId),
        ),
      );
    await database
      .update(constitutionItemVersions)
      .set({ active: false, updatedAt: turn.now })
      .where(
        and(
          eq(constitutionItemVersions.constitutionItemId, item.constitutionItemId),
          eq(constitutionItemVersions.ownerId, ownerId),
          eq(constitutionItemVersions.isCurrent, true),
        ),
      );
  }
  const common = { id: entityId, ownerId, memoryRecordId: recordId };
  if (item.kind === 'fact')
    await database
      .insert(facts)
      .values({
        ...common,
        subject: 'owner',
        predicate: item.title,
        value: { statement: item.statement },
      })
      .onConflictDoUpdate({
        target: facts.id,
        set: {
          memoryRecordId: recordId,
          value: { statement: item.statement },
          updatedAt: turn.now,
        },
        setWhere: eq(facts.ownerId, ownerId),
      });
  if (item.kind === 'preference')
    await database
      .insert(preferences)
      .values({
        ...common,
        topic: item.title,
        value: { statement: item.statement, scope: 'explicit_owner_review' },
      })
      .onConflictDoUpdate({
        target: preferences.id,
        set: {
          memoryRecordId: recordId,
          value: { statement: item.statement, scope: 'explicit_owner_review' },
          updatedAt: turn.now,
        },
        setWhere: eq(preferences.ownerId, ownerId),
      });
  if (item.kind === 'project')
    await database
      .insert(projects)
      .values({ ...common, name: item.title, description: item.statement, status: 'active' })
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          memoryRecordId: recordId,
          name: item.title,
          description: item.statement,
          updatedAt: turn.now,
        },
        setWhere: eq(projects.ownerId, ownerId),
      });
  if (item.kind === 'person')
    await database
      .insert(people)
      .values({
        ...common,
        displayName: item.title,
        metadata: { summary: item.statement, scope: 'named_owner_request_only' },
      })
      .onConflictDoUpdate({
        target: people.id,
        set: {
          memoryRecordId: recordId,
          displayName: item.title,
          metadata: { summary: item.statement, scope: 'named_owner_request_only' },
          updatedAt: turn.now,
        },
        setWhere: eq(people.ownerId, ownerId),
      });
  if (item.kind === 'relationship')
    await database
      .insert(relationships)
      .values({ ...common, relationshipType: 'owner_supplied', description: item.statement })
      .onConflictDoUpdate({
        target: relationships.id,
        set: { memoryRecordId: recordId, description: item.statement, updatedAt: turn.now },
        setWhere: eq(relationships.ownerId, ownerId),
      });
  if (item.kind === 'observation')
    await database
      .insert(observations)
      .values({ ...common, observation: item.statement, observedAt: turn.now })
      .onConflictDoUpdate({
        target: observations.id,
        set: { memoryRecordId: recordId, observation: item.statement, updatedAt: turn.now },
        setWhere: eq(observations.ownerId, ownerId),
      });
  if (item.kind === 'hypothesis')
    await database
      .insert(hypotheses)
      .values({
        ...common,
        hypothesis: item.statement,
        evidenceSummary: 'Owner-authored uncertainty, retained as a hypothesis after review.',
      })
      .onConflictDoUpdate({
        target: hypotheses.id,
        set: { memoryRecordId: recordId, hypothesis: item.statement, updatedAt: turn.now },
        setWhere: eq(hypotheses.ownerId, ownerId),
      });
  if (item.kind === 'commitment' && !item.entityId) {
    const result = await processProposedAction(
      {
        store: new DrizzleTransactionalEventStore(
          database as unknown as JarvisDatabase,
          new CanonicalOnlyDurableJobTransport(),
        ),
        policy: { evaluate: (action) => evaluatePolicy(action, { ownerAuthorized: true }) },
      },
      {
        action: {
          id: ownerBaselineId(`${item.candidateId}:commitment-action`),
          ownerId,
          actionType: 'internal.commitment.create',
          riskClass: 'LOW_RISK_INTERNAL',
          payload: { commitmentId: entityId, title: item.statement },
          idempotencyKey: `owner-baseline-commitment:${item.candidateId}`,
          sourceEventId: turn.request.sourceEventId ?? undefined,
          sourceBrainDecisionId: turn.decisionId,
          correlationId: turn.request.correlationId,
          state: 'proposed',
          expiresAt: null,
        },
        source: 'brain',
        reason: 'The verified owner explicitly confirmed this baseline commitment.',
      },
    );
    if (!result.executed)
      throw new Error('The existing commitment policy did not execute the reviewed creation.');
  }
  if (item.kind === 'commitment') {
    await database
      .update(commitments)
      .set({
        title: item.statement,
        description: item.statement,
        source,
        metadata: {
          ownerBaseline: 1,
          memoryRecordId: recordId,
          confirmationMessageId: turn.inbound.id,
          sensitivity: item.sensitivity,
          personalContextScope: item.personalContextName ? 'named_owner_request_only' : null,
          personalContextName: item.personalContextName,
          validUntil: item.validUntil,
        },
        updatedAt: turn.now,
      })
      .where(and(eq(commitments.id, entityId), eq(commitments.ownerId, ownerId)));
    const [actual] = await database
      .select({ id: commitments.id })
      .from(commitments)
      .where(and(eq(commitments.id, entityId), eq(commitments.ownerId, ownerId)))
      .limit(1);
    if (!actual)
      throw new Error('A reviewed commitment must exist canonically before claiming success.');
  }
  if (item.kind === 'open_loop' || item.kind === 'commitment')
    await database
      .insert(openLoops)
      .values({
        ...common,
        description: item.statement,
        uncertainty: item.kind === 'commitment' ? 'known' : 'unknown',
        relatedCommitmentId: item.kind === 'commitment' ? entityId : null,
      })
      .onConflictDoUpdate({
        target: openLoops.id,
        set: { memoryRecordId: recordId, description: item.statement, updatedAt: turn.now },
        setWhere: eq(openLoops.ownerId, ownerId),
      });
  await database
    .update(memoryCandidates)
    .set({
      state: 'confirmed',
      acceptedMemoryRecordId: recordId,
      reviewedAt: turn.now,
      reviewedByOwnerId: ownerId,
      updatedAt: turn.now,
    })
    .where(and(eq(memoryCandidates.id, item.candidateId), eq(memoryCandidates.ownerId, ownerId)));
  await database.insert(memoryEvidence).values({
    id: ownerBaselineId(`${turn.request.id}:${item.candidateId}:confirmation`),
    ownerId,
    memoryCandidateId: item.candidateId,
    memoryRecordId: recordId,
    evidenceRecordId: turn.inbound.id,
    evidenceType: 'owner_baseline_confirmation',
    authority: 'owner_review',
    observedAt: turn.now,
  });
  await audit(database, turn, 'owner_baseline.memory.confirmed', recordId, {
    candidateId: item.candidateId,
    previousMemoryRecordId: item.acceptedMemoryRecordId,
    kind: item.kind,
    entityId,
  });
  return { ...item, acceptedMemoryRecordId: recordId, entityId };
}

export interface FinalizeOwnerBaselineInput {
  ownerId: string;
  requestId: string;
  decisionId: string;
  responseMessageId: string;
}
/** Mutations, truthful reply, review binding and request completion commit together or roll back. */
export async function finalizeOwnerBaselineTurn(
  database: JarvisDatabase,
  input: FinalizeOwnerBaselineInput,
): Promise<ConversationResponse> {
  return database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`owner-baseline:${input.ownerId}`}, 0))`,
    );
    const [row] = await transaction
      .select({ request: brainRequests, decision: brainDecisions, inbound: messages })
      .from(brainRequests)
      .innerJoin(
        brainDecisions,
        and(
          eq(brainDecisions.brainRequestId, brainRequests.id),
          eq(brainDecisions.ownerId, brainRequests.ownerId),
          eq(brainDecisions.id, input.decisionId),
        ),
      )
      .innerJoin(
        messages,
        and(
          eq(messages.id, brainRequests.messageId),
          eq(messages.ownerId, brainRequests.ownerId),
          eq(messages.conversationId, brainRequests.conversationId),
          eq(messages.direction, 'inbound'),
        ),
      )
      .where(and(eq(brainRequests.ownerId, input.ownerId), eq(brainRequests.id, input.requestId)))
      .limit(1);
    if (
      !row ||
      !row.request.conversationId ||
      row.decision.executionResult.ownerBaselineFinalization !== 1 ||
      row.decision.executionResult.responseMessageId !== input.responseMessageId
    )
      throw new Error('Baseline finalization requires its server-staged owned decision.');
    const [existing] = await transaction
      .select()
      .from(messages)
      .where(and(eq(messages.id, input.responseMessageId), eq(messages.ownerId, input.ownerId)))
      .limit(1);
    if (existing)
      return conversationResponseSchema.parse(
        row.decision.executionResult.finalConversationResponse,
      );
    await assertCanonicalOwner(transaction, row.request, row.inbound);
    const operation = ownerBaselineOperationSchema.parse(
      row.decision.executionResult.ownerBaselineOperation,
    );
    const expectedId = ownerBaselineQuestionnaireId(input.ownerId, row.request.conversationId);
    if (operation.questionnaireId !== expectedId)
      throw new Error('Baseline review cannot cross owners or conversations.');
    const now = new Date();
    const turn: Turn = {
      request: row.request,
      inbound: row.inbound,
      decisionId: row.decision.id,
      now,
    };
    const review = await loadOwnerBaselineReview(transaction, {
      ownerId: input.ownerId,
      conversationId: row.request.conversationId,
      now: row.inbound.receivedAt.toISOString(),
    });
    const items = [...(review?.items ?? [])];
    let pending =
      operation.operation === 'review'
        ? (review?.pendingCorrection ?? null)
        : operation.pendingCorrection;
    let message: string;
    const preview = [...items];
    if (operation.operation === 'stage')
      for (const proposal of operation.proposals) {
        const index = preview.findIndex(
          (item) =>
            (item.kind === proposal.kind &&
              item.title.toLocaleLowerCase('en-US') ===
                proposal.title.toLocaleLowerCase('en-US')) ||
            item.statement.toLocaleLowerCase('en-US') ===
              proposal.statement.toLocaleLowerCase('en-US'),
        );
        const value: OwnerBaselineItem = {
          ...proposal,
          candidateId: turn.request.id,
          ordinal: index >= 0 ? preview[index]!.ordinal : preview.length + 1,
          excluded: false,
          acceptedMemoryRecordId: null,
          constitutionItemId: null,
          entityId: null,
        };
        if (index >= 0) preview[index] = value;
        else preview.push(value);
      }
    const previewIndex = preview.findIndex((item) => item.ordinal === operation.ordinal);
    if (previewIndex >= 0 && operation.operation === 'change' && operation.replacement)
      preview[previewIndex] = { ...preview[previewIndex]!, statement: operation.replacement };
    if (previewIndex >= 0 && operation.operation === 'temporary')
      preview[previewIndex] = {
        ...preview[previewIndex]!,
        temporary: true,
        validUntil: operation.validUntil,
      };
    // Validate the complete review before any candidates are written. Never truncate consent.
    const tooLarge = preview.length > 24 || reviewText(preview).length > 3750;
    await transaction
      .insert(onboardingQuestionnaires)
      .values({
        id: expectedId,
        ownerId: input.ownerId,
        version,
        source: `${source}:${row.request.conversationId}`,
        state: 'pending_review',
      })
      .onConflictDoNothing();
    if (tooLarge) {
      pending = review?.pendingCorrection ?? null;
      message =
        'This batch is too large for one complete review. I kept your current baseline unchanged. Send a smaller batch or shorten the item statements.';
    } else if (operation.expectedRevision !== (review?.revision ?? null)) {
      pending = review?.pendingCorrection ?? null;
      message = `Your baseline draft changed before this turn was applied. Please review the current version first.\n\n${reviewText(items)}`;
    } else if (operation.operation === 'confirm') {
      const validConfirmation =
        /^(?:yes,? (?:save|confirm|approve) (?:those|these|them|my baseline)|save (?:those|these|my baseline)|evet,? (?:bunları kaydet|onayla))[.!?]*$/iu.test(
          row.inbound.content!.trim(),
        );
      if (
        !validConfirmation ||
        !review ||
        !items.length ||
        review.presentedRevision !== review.revision
      )
        message = `I need to show you the current version before saving it.\n\n${reviewText(items)}`;
      else if (
        review.pendingCorrection ||
        items.some(
          (item) =>
            !item.excluded &&
            item.temporary &&
            (!item.validUntil || Date.parse(item.validUntil) <= now.getTime()),
        )
      )
        message = `Finish the correction and give temporary items a future expiry first.\n\n${reviewText(items)}`;
      else if (review.reviewed)
        message = 'This baseline version is already saved. Say “review my baseline” to inspect it.';
      else {
        for (let index = 0; index < items.length; index++)
          items[index] = await approveItem(transaction, turn, items[index]!);
        for (const item of items)
          await writeAnswer(
            transaction,
            input.ownerId,
            expectedId,
            `baseline.item.${item.ordinal}`,
            item,
            item.excluded ? 'rejected' : 'accepted',
            now,
          );
        await transaction
          .update(onboardingQuestionnaires)
          .set({ state: 'accepted', reviewedAt: now, acceptedAt: now, updatedAt: now })
          .where(
            and(
              eq(onboardingQuestionnaires.id, expectedId),
              eq(onboardingQuestionnaires.ownerId, input.ownerId),
            ),
          );
        pending = null;
        message = `Saved ${items.filter((item) => !item.excluded).length} reviewed baseline items. Goals and standing rules were confirmed by you; uncertain items remain hypotheses. No reminder, schedule or external action was created. Say “review my baseline” when you want to inspect or correct it.`;
      }
    } else {
      await transaction
        .insert(onboardingQuestionnaires)
        .values({
          id: expectedId,
          ownerId: input.ownerId,
          version,
          source: `${source}:${row.request.conversationId}`,
          state: 'pending_review',
        })
        .onConflictDoNothing();
      if (operation.operation === 'stage') {
        for (const proposal of operation.proposals) {
          if (!row.inbound.content!.includes(proposal.sourceQuote))
            throw new Error('Baseline source quote is not current canonical owner evidence.');
          const index = items.findIndex(
            (item) =>
              (item.kind === proposal.kind &&
                item.title.toLocaleLowerCase('en-US') ===
                  proposal.title.toLocaleLowerCase('en-US')) ||
              item.statement.toLocaleLowerCase('en-US') ===
                proposal.statement.toLocaleLowerCase('en-US'),
          );
          if (
            index >= 0 &&
            !items[index]!.excluded &&
            canonicalJson(proposalValue(items[index]!)) === canonicalJson(proposal)
          )
            continue;
          const ordinal = index >= 0 ? items[index]!.ordinal : items.length + 1;
          if (ordinal > 24) throw new Error('Review a smaller baseline batch.');
          const item = await stageCandidate(
            transaction,
            turn,
            proposal,
            ordinal,
            index >= 0 ? items[index] : undefined,
          );
          if (index >= 0) items[index] = item;
          else items.push(item);
        }
        pending = null;
      } else if (['exclude', 'change', 'temporary', 'not_goal'].includes(operation.operation)) {
        const index = items.findIndex((item) => item.ordinal === operation.ordinal);
        if (index >= 0) {
          const previous = items[index]!;
          await assertOwnedLinks(transaction, input.ownerId, previous);
          if (operation.operation === 'exclude') items[index] = { ...previous, excluded: true };
          else if (operation.operation === 'change' && operation.replacement)
            items[index] = await stageCandidate(
              transaction,
              turn,
              {
                ...previous,
                statement: operation.replacement,
                sourceQuote: operation.replacement,
                temporary: previous.temporary,
                validUntil: previous.validUntil,
              },
              previous.ordinal,
              previous,
            );
          else if (operation.operation === 'temporary')
            items[index] = await stageCandidate(
              transaction,
              turn,
              {
                ...previous,
                sourceQuote: row.inbound.content!,
                temporary: true,
                validUntil: operation.validUntil,
              },
              previous.ordinal,
              previous,
            );
          else if (operation.operation === 'not_goal')
            items[index] = await stageCandidate(
              transaction,
              turn,
              { ...previous, kind: 'observation', sourceQuote: row.inbound.content! },
              previous.ordinal,
              previous,
            );
        } else
          pending = {
            operation: operation.operation as 'exclude' | 'change' | 'temporary' | 'not_goal',
            ordinal: null,
          };
      }
      if (operation.operation !== 'review')
        for (const item of items)
          await writeAnswer(
            transaction,
            input.ownerId,
            expectedId,
            `baseline.item.${item.ordinal}`,
            item,
            'draft',
            now,
          );
      if (operation.operation !== 'review')
        await transaction
          .update(onboardingQuestionnaires)
          .set({ state: 'pending_review', updatedAt: now })
          .where(
            and(
              eq(onboardingQuestionnaires.id, expectedId),
              eq(onboardingQuestionnaires.ownerId, input.ownerId),
            ),
          );
      message = `${pending ? (pending.ordinal === null ? 'Which item number should I correct?\n\n' : pending.operation === 'temporary' ? `Until when? Say “temporary ${pending.ordinal} until YYYY-MM-DD”.\n\n` : `What should item ${pending.ordinal} say?\n\n`) : ''}${reviewText(items)}`;
    }
    await writeAnswer(
      transaction,
      input.ownerId,
      expectedId,
      'baseline.pending_correction',
      pending,
      'draft',
      now,
    );
    // Never truncate a review into consent to an unseen item or condition.
    const response = conversationResponseSchema.parse({
      message,
      nextAction: null,
      tone: 'neutral',
    });
    const marker = { questionnaireId: expectedId, revision: revision(items) };
    await transaction.insert(messages).values({
      id: input.responseMessageId,
      ownerId: input.ownerId,
      conversationId: row.request.conversationId,
      channel: row.inbound.channel,
      direction: 'outbound',
      contentType: 'text/plain',
      content: response.message,
      deliveryState: 'local_persisted',
      occurredAt: row.request.createdAt,
      receivedAt: now,
      correlationId: row.request.correlationId,
      sourceEventId: row.request.sourceEventId,
      metadata: { nextAction: null, tone: response.tone },
    });
    await transaction
      .update(brainDecisions)
      .set({
        executionResult: {
          ...row.decision.executionResult,
          finalConversationResponse: response,
          ownerBaselineReview: marker,
        },
        updatedAt: now,
      })
      .where(
        and(eq(brainDecisions.id, input.decisionId), eq(brainDecisions.ownerId, input.ownerId)),
      );
    await transaction
      .update(brainRequests)
      .set({ state: 'completed', completedAt: now, updatedAt: now })
      .where(and(eq(brainRequests.id, input.requestId), eq(brainRequests.ownerId, input.ownerId)));
    await audit(transaction, turn, 'owner_baseline.review.applied', expectedId, {
      operation: operation.operation,
      revision: marker.revision,
    });
    return response;
  });
}
