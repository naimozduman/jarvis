import { randomUUID } from 'node:crypto';

import type {
  BrainContext,
  BrainRequest,
  ContextManifest,
  ContextManifestRecord,
  ContextRecord,
  InformationState,
} from '@jarvis/contracts';

export interface ContextAssemblyLimits {
  readonly maxContextRecords: number;
  readonly maxRecentMessages: number;
  readonly maxApproxPromptTokens: number;
}

export interface ContextAssemblyInput {
  readonly request: BrainRequest;
  readonly now: string;
  /** Candidates must already come from owner-scoped repositories; mismatches are discarded again. */
  readonly records: readonly ContextRecord[];
  readonly hardOverrideIds: readonly string[];
  readonly availableData: readonly { readonly domain: string; readonly state: InformationState }[];
}

interface ScoredRecord {
  readonly record: ContextRecord;
  readonly score: number;
  readonly reasons: readonly string[];
}

function approximateTokens(content: string): number {
  // Stable, intentionally conservative approximation. Tokenizer-specific estimation is not needed
  // to cap a Phase 2 prompt before a provider request.
  return Math.ceil(content.length / 3.5);
}

function recencyScore(observedAt: string | null, nowMs: number): number {
  if (!observedAt) {
    return 0;
  }
  const observedAtMs = Date.parse(observedAt);
  if (Number.isNaN(observedAtMs)) {
    return 0;
  }
  const ageHours = Math.max(0, (nowMs - observedAtMs) / 3_600_000);
  return Math.max(0, Math.round(300 - Math.min(300, ageHours * 2)));
}

function deadlineScore(minutes: number | null): number {
  if (minutes === null) {
    return 0;
  }
  if (minutes <= 60) {
    return 1_000;
  }
  if (minutes <= 24 * 60) {
    return 750;
  }
  if (minutes <= 7 * 24 * 60) {
    return 300;
  }
  return 75;
}

function scoreRecord(record: ContextRecord, nowMs: number): ScoredRecord {
  const reasons: string[] = [];
  let score = 0;

  if (record.constitutionalRelevance > 0) {
    score += record.constitutionalRelevance * 100;
    reasons.push('constitutional_relevance');
  }
  if (record.activeCommitmentRelevance > 0) {
    score += record.activeCommitmentRelevance * 80;
    reasons.push('active_commitment_relevance');
  }
  const proximity = deadlineScore(record.deadlineProximityMinutes);
  if (proximity > 0) {
    score += proximity;
    reasons.push('deadline_proximity');
  }
  if (record.currentDayRelevance > 0) {
    score += record.currentDayRelevance * 45;
    reasons.push('current_day_relevance');
  }
  if (record.sourceAuthority > 0) {
    score += record.sourceAuthority * 20;
    reasons.push('source_authority');
  }
  if (record.confidenceBasisPoints > 0) {
    score += Math.floor(record.confidenceBasisPoints / 100);
    reasons.push('confidence');
  }
  const recency = recencyScore(record.observedAt, nowMs);
  if (recency > 0) {
    score += recency;
    reasons.push('recency');
  }
  if (record.informationState === 'conflicting') {
    score += 400;
    reasons.push('conflict_visible');
  }
  if (record.informationState === 'stale') {
    score -= 100;
  }
  if (record.sensitivity === 'restricted') {
    score -= 50;
    reasons.push('restricted_metadata_only');
  }

  return { record, score: Math.max(0, score), reasons: reasons.slice(0, 12) };
}

function withModelSafeContent(record: ContextRecord): {
  readonly record: ContextRecord;
  readonly redacted: boolean;
} {
  if (record.sensitivity !== 'restricted') {
    return { record, redacted: false };
  }

  return {
    record: {
      ...record,
      content: '[Restricted record: content intentionally withheld from the model.]',
    },
    redacted: true,
  };
}

function filterRecentMessages(
  records: readonly ContextRecord[],
  limit: number,
): readonly ContextRecord[] {
  if (limit < 1) {
    return records.filter((record) => record.recordType !== 'message');
  }
  const messages = records
    .filter((record) => record.recordType === 'message')
    .sort((left, right) => (right.observedAt ?? '').localeCompare(left.observedAt ?? ''));
  const allowedMessageIds = new Set(messages.slice(0, limit).map((record) => record.recordId));
  return records.filter(
    (record) => record.recordType !== 'message' || allowedMessageIds.has(record.recordId),
  );
}

/**
 * Owner-scoped, deterministic structured retrieval. This deliberately has no embeddings or model
 * call: its output and the persisted manifest can be reproduced from the supplied candidate set.
 */
export class ContextAssembler {
  public constructor(
    private readonly limits: ContextAssemblyLimits,
    private readonly contextVersion = 'context-v1',
  ) {}

  public assemble(input: ContextAssemblyInput): BrainContext {
    const nowMs = Date.parse(input.now);
    const ownerRecords = filterRecentMessages(
      input.records.filter((record) => record.ownerId === input.request.ownerId),
      this.limits.maxRecentMessages,
    );
    const ranked = ownerRecords
      .map((record) => scoreRecord(record, Number.isNaN(nowMs) ? 0 : nowMs))
      .sort(
        (left, right) =>
          right.score - left.score ||
          (right.record.observedAt ?? '').localeCompare(left.record.observedAt ?? '') ||
          left.record.recordId.localeCompare(right.record.recordId),
      );

    const selected: ContextRecord[] = [];
    const manifestRecords: ContextManifestRecord[] = [];
    let promptTokenEstimate = 0;

    for (const candidate of ranked) {
      if (selected.length >= this.limits.maxContextRecords) {
        break;
      }
      const safe = withModelSafeContent(candidate.record);
      const nextEstimate = approximateTokens(safe.record.content);
      if (promptTokenEstimate + nextEstimate > this.limits.maxApproxPromptTokens) {
        continue;
      }
      selected.push(safe.record);
      promptTokenEstimate += nextEstimate;
      manifestRecords.push({
        recordId: safe.record.recordId,
        recordType: safe.record.recordType,
        rank: selected.length,
        score: candidate.score,
        selectionReasons:
          candidate.reasons.length > 0 ? [...candidate.reasons] : ['structured_retrieval'],
        sensitivity: safe.record.sensitivity,
        redactedForModel: safe.redacted,
      });
    }

    const manifest: ContextManifest = {
      id: randomUUID(),
      ownerId: input.request.ownerId,
      brainRequestId: input.request.id,
      contextVersion: this.contextVersion,
      promptTokenEstimate,
      recordLimit: this.limits.maxContextRecords,
      selectedRecords: manifestRecords,
      excludedRecordCount: ownerRecords.length - selected.length,
      createdAt: input.now,
    };

    return {
      request: input.request,
      now: input.now,
      records: selected,
      manifest,
      hardOverrideIds: [...new Set(input.hardOverrideIds)].sort(),
      availableData: input.availableData.map((item) => ({ ...item })),
    };
  }
}
