import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { ownerNamesPersonalContext, type ContextRecord } from '@jarvis/contracts';
export { ownerNamesPersonalContext } from '@jarvis/contracts';
import type { JarvisDatabase } from './client.js';
import { memoryRecords, projects, people, relationships, openLoops } from './schema/index.js';
import { dailyUseRecord } from './owner-feedback.js';

export function baselineRelevance(content: string, ownerMessage: string = ''): number {
  const terms = ownerMessage.toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const text = content.toLocaleLowerCase('en-US');
  return [...new Set(terms)].filter((term) => text.includes(term)).length;
}

/** A small projection of approved roots, never draft onboarding answers or relationship history. */
export async function loadOwnerBaselineContext(
  database: JarvisDatabase,
  input: { ownerId: string; now: string; ownerMessage?: string },
): Promise<readonly ContextRecord[]> {
  const at = new Date(input.now);
  const rows = await database
    .select()
    .from(memoryRecords)
    .where(
      and(
        eq(memoryRecords.ownerId, input.ownerId),
        eq(memoryRecords.source, 'owner_bootstrap'),
        eq(memoryRecords.active, true),
        isNotNull(memoryRecords.reviewedAt),
        sql`(${memoryRecords.validFrom} is null or ${memoryRecords.validFrom} <= ${at})`,
        sql`(${memoryRecords.validTo} is null or ${memoryRecords.validTo} > ${at})`,
      ),
    )
    .orderBy(desc(memoryRecords.updatedAt))
    .limit(48);
  const records: ContextRecord[] = [];
  for (const row of rows) {
    if (row.kind === 'preference') continue; // Existing preference projection is authoritative.
    const summary = typeof row.metadata.statement === 'string' ? row.metadata.statement : null;
    const title = typeof row.metadata.title === 'string' ? row.metadata.title : null;
    if (!summary || !title || row.metadata.ownerBaseline !== 1) continue;
    if (
      row.metadata.personalContextScope === 'named_owner_request_only' &&
      !ownerNamesPersonalContext(row.metadata.personalContextName, input.ownerMessage)
    )
      continue;
    let entityId: string | null = null;
    if (row.kind === 'person' || row.kind === 'relationship') {
      // A deliberately supplied name must be named again in this private owner request.
      if (
        row.metadata.personalContextScope !== 'named_owner_request_only' ||
        !ownerNamesPersonalContext(row.metadata.personalContextName, input.ownerMessage)
      )
        continue;
      const table = row.kind === 'person' ? people : relationships;
      const [entity] = await database
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.memoryRecordId, row.id), eq(table.ownerId, input.ownerId)))
        .limit(1);
      if (!entity) continue;
      entityId = entity.id;
    } else if (row.kind === 'project') {
      const [project] = await database
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.memoryRecordId, row.id),
            eq(projects.ownerId, input.ownerId),
            eq(projects.status, 'active'),
          ),
        )
        .limit(1);
      if (!project) continue;
      entityId = project.id;
    } else if (row.kind === 'open_loop') {
      const [loop] = await database
        .select({ id: openLoops.id, commitmentId: openLoops.relatedCommitmentId })
        .from(openLoops)
        .where(
          and(
            eq(openLoops.memoryRecordId, row.id),
            eq(openLoops.ownerId, input.ownerId),
            eq(openLoops.state, 'open'),
            eq(openLoops.resolutionState, 'unresolved'),
          ),
        )
        .limit(1);
      if (!loop || loop.commitmentId) continue; // Canonical commitment projection supplies status.
      entityId = loop.id;
    }
    const match = baselineRelevance(`${title} ${summary}`, input.ownerMessage);
    records.push({
      ...dailyUseRecord({
        id: row.id,
        ownerId: input.ownerId,
        type: row.kind,
        at: row.updatedAt.toISOString(),
        content: JSON.stringify({
          title,
          statement: summary,
          scope: row.metadata.personalContextScope,
          source: row.source,
        }),
      }),
      sensitivity: row.sensitivity,
      confidenceBasisPoints: row.confidenceBasisPoints,
      informationState:
        row.reviewAt && row.reviewAt <= at
          ? 'stale'
          : row.kind === 'hypothesis'
            ? 'inferred'
            : 'known',
      entityReferences: entityId ? [entityId] : [],
      currentDayRelevance: Math.min(100, 50 + match * 10),
      activeCommitmentRelevance: row.kind === 'project' || row.kind === 'open_loop' ? 40 : 0,
    });
  }
  return records
    .sort(
      (a, b) =>
        baselineRelevance(b.content, input.ownerMessage) -
        baselineRelevance(a.content, input.ownerMessage),
    )
    .slice(0, 6);
}
