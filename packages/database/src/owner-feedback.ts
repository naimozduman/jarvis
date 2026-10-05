import { createHash } from 'node:crypto';
import { and, desc, eq, gt, inArray, lt, or, sql } from 'drizzle-orm';
import type { ContextRecord, OwnerTurnFeedback, RecordedOwnerFeedback } from '@jarvis/contracts';
import type { JarvisDatabase } from './client.js';
import {
  auditEvents,
  brainDecisions,
  brainRequests,
  commitments,
  constitutionProposals,
  hardOverrides,
  hardOverrideEntityLinks,
  memoryCandidates,
  memoryEvidence,
  memoryRecords,
  messages,
  preferences,
} from './schema/index.js';

function stableId(value: string): string {
  const hex = createHash('sha256').update(value).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface RecordOwnerFeedbackInput {
  readonly ownerId: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly sourceEventId: string | null;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly channel: string;
  readonly feedback: OwnerTurnFeedback;
}

/** Reuses canonical memory candidates/evidence/preferences and the existing audit ledger. */
export async function recordOwnerFeedback(
  database: JarvisDatabase,
  input: RecordOwnerFeedbackInput,
): Promise<RecordedOwnerFeedback> {
  return database.transaction(async (transaction) => {
    // Serialize this owner's preference supersession and concurrent replays without a new table.
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`owner-feedback:${input.ownerId}`}, 0))`,
    );
    const candidateId = stableId(`owner-feedback:${input.ownerId}:${input.messageId}`);
    const [existing] = await transaction
      .select()
      .from(memoryCandidates)
      .where(and(eq(memoryCandidates.id, candidateId), eq(memoryCandidates.ownerId, input.ownerId)))
      .limit(1);
    if (existing) {
      const saved = JSON.parse(existing.normalizedStatement) as OwnerTurnFeedback;
      if (
        saved.category !== input.feedback.category ||
        saved.scope !== input.feedback.scope ||
        saved.directive !== input.feedback.directive ||
        saved.quote !== input.feedback.quote
      ) {
        throw new Error('A feedback replay cannot alter its original evidence.');
      }
      const count =
        await transaction.execute(sql`select count(distinct c.source_brain_decision_id)::int as count
        from jarvis.memory_candidates c join jarvis.memory_evidence e on e.memory_candidate_id = c.id and e.owner_id = c.owner_id
        where c.owner_id = ${input.ownerId}::uuid and c.created_at > ${new Date(Date.parse(input.occurredAt) - 30 * 86_400_000)}
          and e.evidence_type = ${`owner_turn_feedback:${input.feedback.category}:one_turn:${input.feedback.directive}`}`);
      return {
        candidateId,
        targetDecisionId: existing.sourceBrainDecisionId ?? null,
        targetResponseId: existing.relatedEntityIds[0] ?? null,
        scope: input.feedback.scope,
        repeatedEvidenceCount: Number(count.rows[0]?.count ?? 0),
      };
    }
    // Validate canonical inbound ownership; transport metadata is never accepted as a substitute.
    const [inbound] = await transaction
      .select({
        id: messages.id,
        content: messages.content,
        sourceEventId: messages.sourceEventId,
        channel: messages.channel,
      })
      .from(messages)
      .where(
        and(
          eq(messages.id, input.messageId),
          eq(messages.ownerId, input.ownerId),
          eq(messages.conversationId, input.conversationId),
          eq(messages.direction, 'inbound'),
        ),
      )
      .limit(1);
    if (
      !inbound ||
      inbound.content?.trim() !== input.feedback.quote ||
      inbound.channel !== input.channel ||
      (inbound.sourceEventId ?? null) !== input.sourceEventId
    ) {
      throw new Error('Owner feedback requires its exact canonical inbound message.');
    }
    const [target] = await transaction
      .select({ decisionId: brainDecisions.id, responseId: messages.id })
      .from(messages)
      .innerJoin(
        brainRequests,
        and(
          eq(brainRequests.ownerId, messages.ownerId),
          eq(brainRequests.sourceEventId, messages.sourceEventId),
          eq(brainRequests.conversationId, messages.conversationId),
        ),
      )
      .innerJoin(
        brainDecisions,
        and(
          eq(brainDecisions.brainRequestId, brainRequests.id),
          eq(brainDecisions.ownerId, input.ownerId),
        ),
      )
      .where(
        and(
          eq(messages.ownerId, input.ownerId),
          eq(messages.conversationId, input.conversationId),
          eq(messages.direction, 'outbound'),
          eq(brainRequests.state, 'completed'),
          or(
            inArray(messages.deliveryState, ['sent', 'delivered', 'read', 'accepted']),
            sql`exists(select 1 from jarvis.outbound_message_deliveries d where d.owner_id = ${input.ownerId}::uuid
            and d.message_id = ${messages.id} and d.accepted_at is not null)`,
          ),
          lt(messages.occurredAt, new Date(input.occurredAt)),
          gt(messages.occurredAt, new Date(Date.parse(input.occurredAt) - 86_400_000)),
        ),
      )
      .orderBy(desc(messages.occurredAt), desc(messages.id))
      .limit(1);
    // A bare correction with no knowable target is still evidence, explicitly unbound.
    const statement = JSON.stringify({
      version: 1,
      category: input.feedback.category,
      scope: input.feedback.scope,
      directive: input.feedback.directive,
      targetBound: Boolean(target),
      quote: input.feedback.quote,
    });
    const explicit = input.feedback.scope === 'explicit_owner_preference';
    const recordId = explicit ? stableId(`owner-preference:${candidateId}`) : null;
    await transaction.insert(memoryCandidates).values({
      id: candidateId,
      ownerId: input.ownerId,
      kind:
        input.feedback.scope === 'constitution_candidate'
          ? 'constitution_candidate'
          : explicit
            ? 'preference'
            : 'observation',
      normalizedStatement: statement,
      authority: 'explicit_owner_statement',
      sourceEventId: input.sourceEventId ?? undefined,
      sourceMessageId: input.messageId,
      sourceBrainDecisionId: target?.decisionId,
      confidenceBasisPoints: 10_000,
      sensitivity: 'sensitive',
      requiresOwnerConfirmation: !explicit,
      state: explicit ? 'confirmed' : 'pending_review',
      relatedEntityIds: target ? [target.responseId] : [],
      createdAt: new Date(input.occurredAt),
      updatedAt: new Date(input.occurredAt),
      reviewedAt: explicit ? new Date(input.occurredAt) : undefined,
      reviewedByOwnerId: explicit ? input.ownerId : undefined,
    });
    await transaction.insert(memoryEvidence).values({
      id: stableId(`owner-feedback-evidence:${candidateId}`),
      ownerId: input.ownerId,
      memoryCandidateId: candidateId,
      evidenceRecordId: input.messageId,
      evidenceType: `owner_turn_feedback:${input.feedback.category}:${input.feedback.scope}:${input.feedback.category === 'rule' ? 'draft' : input.feedback.directive}`,
      authority: 'explicit_owner_statement',
      observedAt: new Date(input.occurredAt),
      confidenceDeltaBasisPoints: 0,
    });
    if (input.feedback.scope === 'constitution_candidate')
      await transaction.insert(constitutionProposals).values({
        id: stableId(`owner-rule-draft:${candidateId}`),
        ownerId: input.ownerId,
        sourceBrainDecisionId: target?.decisionId,
        category: 'general',
        principle: input.feedback.directive,
        priority: 50,
        flexibility: 'negotiable',
        state: 'draft',
        proposedBy: 'explicit_owner_candidate',
        correlationId: input.correlationId,
        createdAt: new Date(input.occurredAt),
        updatedAt: new Date(input.occurredAt),
      });
    let priorPreferenceId: string | null = null;
    let priorDirective: unknown = null;
    if (explicit && recordId) {
      const topic = `owner_conversation:${input.feedback.category}`;
      const prior = await transaction
        .select({ id: memoryRecords.id, metadata: memoryRecords.metadata })
        .from(memoryRecords)
        .innerJoin(
          preferences,
          and(
            eq(preferences.memoryRecordId, memoryRecords.id),
            eq(preferences.ownerId, input.ownerId),
          ),
        )
        .where(
          and(
            eq(memoryRecords.ownerId, input.ownerId),
            eq(memoryRecords.active, true),
            eq(memoryRecords.source, 'owner_turn_feedback'),
            eq(preferences.topic, topic),
          ),
        );
      priorPreferenceId = prior[0]?.id ?? null;
      priorDirective = prior[0]?.metadata.directive ?? null;
      for (const item of prior)
        await transaction
          .update(memoryRecords)
          .set({
            active: false,
            validTo: new Date(input.occurredAt),
            supersededByMemoryRecordId: recordId,
            updatedAt: new Date(input.occurredAt),
          })
          .where(and(eq(memoryRecords.id, item.id), eq(memoryRecords.ownerId, input.ownerId)));
      await transaction.insert(memoryRecords).values({
        id: recordId,
        ownerId: input.ownerId,
        kind: 'preference',
        source: 'owner_turn_feedback',
        sourceEventId: input.sourceEventId ?? undefined,
        confidenceBasisPoints: 10_000,
        sensitivity: 'sensitive',
        active: true,
        evidenceCount: 1,
        reviewedAt: new Date(input.occurredAt),
        validFrom: new Date(input.occurredAt),
        metadata: {
          category: input.feedback.category,
          directive: input.feedback.directive,
          candidateId,
          scope: 'explicit_owner_preference',
          authority: 'presentation_only',
        },
        createdAt: new Date(input.occurredAt),
        updatedAt: new Date(input.occurredAt),
      });
      await transaction.insert(preferences).values({
        ownerId: input.ownerId,
        memoryRecordId: recordId,
        topic,
        value: { directive: input.feedback.directive, presentationOnly: true },
      });
      await transaction
        .update(memoryCandidates)
        .set({ acceptedMemoryRecordId: recordId })
        .where(
          and(eq(memoryCandidates.id, candidateId), eq(memoryCandidates.ownerId, input.ownerId)),
        );
    }
    await transaction.insert(auditEvents).values({
      id: stableId(`owner-feedback-audit:${candidateId}`),
      ownerId: input.ownerId,
      actorType: 'owner',
      actorId: input.ownerId,
      action: explicit ? 'owner.preference.recorded' : 'owner.turn_feedback.recorded',
      targetType: 'memory_candidate',
      targetId: candidateId,
      occurredAt: new Date(input.occurredAt),
      correlationId: input.correlationId,
      source: 'owner_turn_feedback',
      previousStateReference: priorPreferenceId ? { memoryRecordId: priorPreferenceId } : undefined,
      resultingStateReference: { candidateId, memoryRecordId: recordId },
      metadata: {
        category: input.feedback.category,
        scope: input.feedback.scope,
        targetDecisionId: target?.decisionId ?? null,
        targetResponseId: target?.responseId ?? null,
        surface: input.channel,
        trigger: 'manual_owner',
        authorityChanged: false,
        ...(input.feedback.category === 'mode'
          ? { previousMode: priorDirective ?? 'default', newMode: input.feedback.directive }
          : {}),
      },
    });
    const counts =
      await transaction.execute(sql`select count(distinct c.source_brain_decision_id)::int as count
      from jarvis.memory_candidates c join jarvis.memory_evidence e on e.memory_candidate_id = c.id and e.owner_id = c.owner_id
      where c.owner_id = ${input.ownerId}::uuid and c.created_at > ${new Date(Date.parse(input.occurredAt) - 30 * 86_400_000)}
      and e.evidence_type = ${`owner_turn_feedback:${input.feedback.category}:one_turn:${input.feedback.directive}`}`);
    return {
      candidateId,
      targetDecisionId: target?.decisionId ?? null,
      targetResponseId: target?.responseId ?? null,
      scope: input.feedback.scope,
      repeatedEvidenceCount: Number(counts.rows[0]?.count ?? 0),
    };
  });
}

export interface RecordOwnerAccountabilityOverrideInput {
  readonly ownerId: string;
  readonly conversationId: string;
  readonly messageId: string;
  readonly commitmentId: string;
  readonly sourceEventId: string | null;
  readonly statement: string;
  readonly correlationId: string;
  readonly now: string;
}

/** A current explicit owner choice suppresses conversational challenge, never policy or completion checks. */
export async function recordOwnerAccountabilityOverride(
  database: JarvisDatabase,
  input: RecordOwnerAccountabilityOverrideInput,
): Promise<void> {
  await database.transaction(async (transaction) => {
    const [source] = await transaction
      .select({ content: messages.content })
      .from(messages)
      .where(
        and(
          eq(messages.id, input.messageId),
          eq(messages.ownerId, input.ownerId),
          eq(messages.conversationId, input.conversationId),
          eq(messages.direction, 'inbound'),
        ),
      )
      .limit(1);
    const [commitment] = await transaction
      .select({ id: commitments.id })
      .from(commitments)
      .where(and(eq(commitments.id, input.commitmentId), eq(commitments.ownerId, input.ownerId)))
      .limit(1);
    if (
      !commitment ||
      source?.content?.trim() !== input.statement.trim() ||
      input.statement.length > 1_000
    ) {
      throw new Error('A hard override requires a grounded canonical owner assertion.');
    }
    const id = stableId(`owner-accountability-override:${input.ownerId}:${input.messageId}`);
    const [inserted] = await transaction
      .insert(hardOverrides)
      .values({
        id,
        ownerId: input.ownerId,
        statement: input.statement,
        scope: 'conversation_commitment',
        temporary: true,
        reason: 'Explicit owner choice; commitment remains open and security policy is unchanged.',
        sourceEventId: input.sourceEventId ?? undefined,
        sourceMessageId: input.messageId,
        activeFrom: new Date(input.now),
        expiresAt: new Date(Date.parse(input.now) + 86_400_000),
        consequenceExplainedAt: new Date(input.now),
        correlationId: input.correlationId,
      })
      .onConflictDoNothing()
      .returning({ id: hardOverrides.id });
    if (!inserted) return;
    await transaction.insert(hardOverrideEntityLinks).values({
      ownerId: input.ownerId,
      hardOverrideId: id,
      entityType: 'commitment',
      entityId: input.commitmentId,
    });
    await transaction.insert(auditEvents).values({
      id: stableId(`owner-override-audit:${id}`),
      ownerId: input.ownerId,
      actorType: 'owner',
      actorId: input.ownerId,
      action: 'accountability.owner_override.recorded',
      targetType: 'hard_override',
      targetId: id,
      occurredAt: new Date(input.now),
      correlationId: input.correlationId,
      source: 'conversation_turn',
      metadata: {
        commitmentId: input.commitmentId,
        presentationOnly: true,
        authorityChanged: false,
        scope: 'conversation_commitment',
        expiresAfterHours: 24,
      },
    });
  });
}

export function dailyUseRecord(input: {
  id: string;
  ownerId: string;
  type: string;
  content: string;
  at: string;
  entities?: readonly string[];
}): ContextRecord {
  return {
    recordId: input.id,
    ownerId: input.ownerId,
    recordType: input.type,
    source: 'canonical_daily_use',
    informationState: 'known',
    confidenceBasisPoints: 10_000,
    sensitivity: 'sensitive',
    observedAt: input.at,
    content: input.content,
    entityReferences: [...(input.entities ?? [])],
    constitutionalRelevance: 0,
    activeCommitmentRelevance: input.type === 'commitment' ? 80 : 0,
    deadlineProximityMinutes: null,
    currentDayRelevance: 90,
    sourceAuthority: 100,
  };
}

export async function loadOwnerFeedbackContext(
  database: JarvisDatabase,
  input: { ownerId: string; now: string },
): Promise<readonly ContextRecord[]> {
  const active = await database
    .select()
    .from(memoryRecords)
    .where(
      and(
        eq(memoryRecords.ownerId, input.ownerId),
        eq(memoryRecords.active, true),
        eq(memoryRecords.source, 'owner_turn_feedback'),
      ),
    )
    .orderBy(desc(memoryRecords.updatedAt))
    .limit(8);
  const records = active.map((row) =>
    dailyUseRecord({
      id: row.id,
      ownerId: input.ownerId,
      type: 'owner_preference',
      at: row.updatedAt.toISOString(),
      content: JSON.stringify({
        scope: 'explicit_owner_preference',
        category: row.metadata.category,
        directive: row.metadata.directive,
        presentationOnly: true,
      }),
    }),
  );
  // Repeated corrections suggest a tentative adjustment, never an activated trait or constitution.
  const result =
    await database.execute(sql`select min(c.id::text) as id, max(c.created_at) as observed_at,
      split_part(e.evidence_type, ':', 2) as category, split_part(e.evidence_type, ':', 4) as directive,
      count(distinct c.source_brain_decision_id)::int as evidence_count
    from jarvis.memory_candidates c join jarvis.memory_evidence e on e.memory_candidate_id = c.id and e.owner_id = c.owner_id
    where c.owner_id = ${input.ownerId}::uuid and e.evidence_type like 'owner_turn_feedback:%:one_turn:%'
      and c.created_at > ${new Date(Date.parse(input.now) - 30 * 86_400_000)}
      and c.state = 'pending_review' and split_part(e.evidence_type, ':', 2) in ('brevity', 'tone', 'challenge')
    group by category, directive having count(distinct c.source_brain_decision_id) >= 3
    order by max(c.created_at) desc limit 4`);
  for (const row of result.rows)
    records.push(
      dailyUseRecord({
        id: String(row.id),
        ownerId: input.ownerId,
        type: 'preference_evidence',
        at: new Date(String(row.observed_at)).toISOString(),
        content: JSON.stringify({
          scope: 'repeated_preference_evidence',
          category: row.category,
          directive: row.directive,
          distinctCompletedTurns: row.evidence_count,
          provisional: true,
          activatedPersonalityRule: false,
        }),
      }),
    );
  return records;
}
