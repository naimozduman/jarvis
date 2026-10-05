import { and, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { ContextRecord, DailyUseCommitment } from '@jarvis/contracts';
import type { JarvisDatabase } from './client.js';
import {
  commitments,
  constitutionItems,
  constitutionItemVersions,
  memoryRecords,
  owners,
  personalityTraits,
  preferences,
  planBlocks,
} from './schema/index.js';
import { dailyUseRecord, loadOwnerFeedbackContext } from './owner-feedback.js';
import {
  baselineRelevance,
  loadOwnerBaselineContext,
  ownerNamesPersonalContext,
} from './owner-baseline-context.js';

export interface DailyUseState {
  readonly records: readonly ContextRecord[];
  readonly commitments: readonly DailyUseCommitment[];
  readonly hardOverrideIds: readonly string[];
  readonly quietModeActive: boolean;
}

/** Small read-only projection of existing canonical state. It never edits a plan or reminder. */
export async function loadDailyUseState(
  database: JarvisDatabase,
  input: { ownerId: string; now: string; ownerMessage?: string },
): Promise<DailyUseState> {
  const nowMs = Date.parse(input.now);
  const [owner] = await database
    .select({ timezone: owners.timezone })
    .from(owners)
    .where(eq(owners.id, input.ownerId))
    .limit(1);
  let localDate: Intl.DateTimeFormat | null = null;
  try {
    if (owner?.timezone) localDate = new Intl.DateTimeFormat('en-CA', { timeZone: owner.timezone });
  } catch {
    // An unknown timezone cannot establish a same-day slot; absolute future windows stay known.
  }
  const today = localDate?.format(new Date(input.now)) ?? null;
  const rows = await database
    .select()
    .from(commitments)
    .where(
      and(
        eq(commitments.ownerId, input.ownerId),
        inArray(commitments.status, ['open', 'in_progress', 'overdue', 'deferred']),
      ),
    )
    .orderBy(desc(commitments.priority), desc(commitments.updatedAt))
    .limit(6);
  const constitution = await database
    .select({
      id: constitutionItems.id,
      principle: constitutionItemVersions.principle,
      priority: constitutionItemVersions.priority,
      flexibility: constitutionItemVersions.flexibility,
      updatedAt: constitutionItemVersions.updatedAt,
      exceptions: constitutionItemVersions.exceptions,
    })
    .from(constitutionItems)
    .innerJoin(
      constitutionItemVersions,
      and(
        eq(constitutionItemVersions.constitutionItemId, constitutionItems.id),
        eq(constitutionItemVersions.ownerId, constitutionItems.ownerId),
        eq(constitutionItemVersions.isCurrent, true),
        eq(constitutionItemVersions.active, true),
      ),
    )
    .where(and(eq(constitutionItems.ownerId, input.ownerId), eq(constitutionItems.active, true)))
    .orderBy(desc(constitutionItemVersions.priority))
    .limit(24);
  const selectedConstitution = constitution
    .filter(
      (row) =>
        !row.exceptions.some(
          (entry) => typeof entry.validUntil === 'string' && Date.parse(entry.validUntil) <= nowMs,
        ) &&
        !row.exceptions.some(
          (entry) =>
            entry.personalContextName &&
            !ownerNamesPersonalContext(entry.personalContextName, input.ownerMessage),
        ),
    )
    .sort(
      (a, b) =>
        baselineRelevance(b.principle, input.ownerMessage) -
          baselineRelevance(a.principle, input.ownerMessage) || b.priority - a.priority,
    )
    .slice(0, 6);
  const records = [
    ...(await loadOwnerFeedbackContext(database, input)),
    ...(await loadOwnerBaselineContext(database, input)),
    ...selectedConstitution.map((row) => ({
      ...dailyUseRecord({
        id: row.id,
        ownerId: input.ownerId,
        type: 'constitution',
        at: row.updatedAt.toISOString(),
        content: JSON.stringify({
          principle: row.principle,
          priority: row.priority,
          flexibility: row.flexibility,
          active: true,
          scope: row.exceptions.some((entry) => entry.personalContextName)
            ? 'named_owner_request_only'
            : null,
        }),
      }),
      sensitivity: row.exceptions.some((entry) => entry.sensitivity === 'restricted')
        ? ('restricted' as const)
        : ('sensitive' as const),
    })),
  ];
  const approvedPreferences = await database
    .select({ record: memoryRecords, preference: preferences })
    .from(memoryRecords)
    .innerJoin(
      preferences,
      and(
        eq(preferences.memoryRecordId, memoryRecords.id),
        eq(preferences.ownerId, memoryRecords.ownerId),
      ),
    )
    .where(
      and(
        eq(memoryRecords.ownerId, input.ownerId),
        eq(memoryRecords.active, true),
        isNotNull(memoryRecords.reviewedAt),
        ne(memoryRecords.source, 'owner_turn_feedback'),
      ),
    )
    .orderBy(desc(memoryRecords.updatedAt))
    .limit(6);
  for (const { record, preference } of approvedPreferences) {
    if (
      record.metadata.personalContextScope === 'named_owner_request_only' &&
      !ownerNamesPersonalContext(record.metadata.personalContextName, input.ownerMessage)
    )
      continue;
    if (
      (record.validFrom && record.validFrom.getTime() > nowMs) ||
      (record.validTo && record.validTo.getTime() <= nowMs)
    )
      continue;
    records.push({
      ...dailyUseRecord({
        id: record.id,
        ownerId: input.ownerId,
        type: 'owner_preference',
        at: record.updatedAt.toISOString(),
        content: JSON.stringify({
          topic: preference.topic,
          value: preference.value,
          scope: 'owner_reviewed_preference',
          source: record.source,
        }).slice(0, 4_000),
      }),
      sensitivity: record.sensitivity,
      informationState: record.reviewAt && record.reviewAt.getTime() <= nowMs ? 'stale' : 'known',
    });
  }
  const approvedTraits = await database
    .select({ record: memoryRecords, trait: personalityTraits })
    .from(memoryRecords)
    .innerJoin(
      personalityTraits,
      and(
        eq(personalityTraits.memoryRecordId, memoryRecords.id),
        eq(personalityTraits.ownerId, memoryRecords.ownerId),
      ),
    )
    .where(
      and(
        eq(memoryRecords.ownerId, input.ownerId),
        eq(memoryRecords.active, true),
        isNotNull(memoryRecords.reviewedAt),
      ),
    )
    .orderBy(desc(memoryRecords.updatedAt))
    .limit(6);
  for (const { record, trait } of approvedTraits) {
    if (
      (record.validFrom && record.validFrom.getTime() > nowMs) ||
      (record.validTo && record.validTo.getTime() <= nowMs)
    )
      continue;
    records.push({
      ...dailyUseRecord({
        id: record.id,
        ownerId: input.ownerId,
        type: 'personality_trait',
        at: record.updatedAt.toISOString(),
        content: JSON.stringify({
          trait: trait.trait,
          value: trait.value,
          frozen: trait.frozen,
          learningEnabled: trait.learningEnabled,
          scope: 'owner_reviewed_trait',
        }),
      }),
      sensitivity: record.sensitivity,
      informationState: record.reviewAt && record.reviewAt.getTime() <= nowMs ? 'stale' : 'known',
    });
  }
  const overrides =
    await database.execute(sql`select h.id, h.consequence_explained_at, l.entity_id from jarvis.hard_overrides h
    join jarvis.hard_override_entity_links l on l.hard_override_id = h.id and l.owner_id = h.owner_id and l.entity_type = 'commitment'
    where h.owner_id = ${input.ownerId}::uuid and h.scope = 'conversation_commitment' and h.revoked_at is null and h.active_from <= ${new Date(input.now)}
      and (h.expires_at is null or h.expires_at > ${new Date(input.now)}) limit 24`);
  const quiet = await database.execute(sql`select exists(select 1 from jarvis.quiet_mode_periods
    where owner_id = ${input.ownerId}::uuid and active = true and starts_at <= ${new Date(input.now)}
      and (ends_at is null or ends_at > ${new Date(input.now)})) as active`);
  const snapshots: DailyUseCommitment[] = [];
  for (const row of rows) {
    if (
      row.metadata.ownerBaseline === 1 &&
      ((row.metadata.personalContextScope === 'named_owner_request_only' &&
        !ownerNamesPersonalContext(row.metadata.personalContextName, input.ownerMessage)) ||
        (typeof row.metadata.validUntil === 'string' &&
          Date.parse(row.metadata.validUntil) <= nowMs))
    )
      continue;
    const blocks = await database
      .select()
      .from(planBlocks)
      .where(
        and(
          eq(planBlocks.ownerId, input.ownerId),
          eq(planBlocks.commitmentId, row.id),
          eq(planBlocks.completionState, 'planned'),
        ),
      )
      .orderBy(planBlocks.startAt)
      .limit(8);
    const timed = blocks.filter((block): block is typeof block & { startAt: Date; endAt: Date } =>
      Boolean(block.startAt && block.endAt),
    );
    const current = timed.find(
      (block) => block.startAt.getTime() <= nowMs && block.endAt.getTime() > nowMs,
    );
    const future = timed.filter((block) => block.startAt.getTime() > nowMs);
    const facts = await database.execute(sql`select
      (select min(due_at) from jarvis.commitment_deadlines where owner_id = ${input.ownerId}::uuid and commitment_id = ${row.id}::uuid) as due_at,
      exists(select 1 from jarvis.commitment_dependencies d join jarvis.commitments c on c.id = d.depends_on_commitment_id and c.owner_id = d.owner_id
        where d.owner_id = ${input.ownerId}::uuid and d.commitment_id = ${row.id}::uuid and c.status <> 'completed') as dependency_blocked,
      exists(select 1 from jarvis.audit_events where owner_id = ${input.ownerId}::uuid and target_id = ${row.id}::uuid
        and action = 'accountability.challenge.prepared' and occurred_at > ${new Date(nowMs - 86_400_000)}) as already_challenged`);
    const fact = facts.rows[0];
    const dueMs = fact?.due_at ? new Date(String(fact.due_at)).getTime() : null;
    const snapshot: DailyUseCommitment = {
      id: row.id,
      title: row.title,
      importance: row.priority,
      consequence: row.consequence,
      minimumAcceptableVersion: row.minimumAcceptableVersion,
      minimumMinutes: current?.minimumDurationMinutes ?? future[0]?.minimumDurationMinutes ?? null,
      deadlineMinutes: dueMs === null ? null : Math.floor((dueMs - nowMs) / 60_000),
      remainingMinutes: current
        ? Math.max(0, Math.floor((current.endAt.getTime() - nowMs) / 60_000))
        : 0,
      constraintsKnown: Boolean(current),
      dependenciesMet: fact?.dependency_blocked === false,
      alternateWindowsToday: future.filter(
        (block) =>
          today !== null &&
          localDate?.format(block.startAt) === today &&
          (dueMs === null || block.endAt.getTime() <= dueMs),
      ).length,
      nextProtectedWindowExists: future.some(
        (block) => dueMs === null || block.endAt.getTime() <= dueMs,
      ),
      alreadyChallenged: fact?.already_challenged === true,
      hardOverrideActive: overrides.rows.some((override) => override.entity_id === row.id),
      overrideConsequenceExplained: overrides.rows.some(
        (override) => override.entity_id === row.id && override.consequence_explained_at !== null,
      ),
    };
    // Restricted details must not enter model prompts through accountability guidance either.
    if (row.metadata.sensitivity !== 'restricted') snapshots.push(snapshot);
    records.push({
      ...dailyUseRecord({
        id: row.id,
        ownerId: input.ownerId,
        type: 'commitment',
        at: row.updatedAt.toISOString(),
        content: JSON.stringify({
          ...snapshot,
          status: row.status,
          flexibility: row.flexibility,
          source: row.source,
          scope: row.metadata.personalContextScope,
          completionEvidence: 'No completion inferred from silence.',
        }),
      }),
      sensitivity: row.metadata.sensitivity === 'restricted' ? 'restricted' : 'sensitive',
    });
  }
  return {
    records,
    commitments: snapshots,
    hardOverrideIds: [...new Set(overrides.rows.map((row) => String(row.id)))],
    quietModeActive: quiet.rows[0]?.active === true,
  };
}
