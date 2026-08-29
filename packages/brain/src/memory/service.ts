import { randomUUID } from 'node:crypto';

import type {
  MemoryAuthority,
  MemoryCandidate,
  MemoryCandidateKind,
  MemoryEvidence,
} from '@jarvis/contracts';

import { authorityWeight, evaluateMemoryPromotion } from './promotion-policy.js';

export interface DurableMemoryRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly kind: Exclude<MemoryCandidateKind, 'constitution_candidate'>;
  readonly statement: string;
  readonly source: string;
  readonly confidenceBasisPoints: number;
  readonly sensitivity: 'normal' | 'sensitive' | 'restricted';
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly reviewAt: string | null;
  readonly reviewedAt: string | null;
  readonly active: boolean;
  readonly evidenceCount: number;
  readonly positiveEvidenceCount: number;
  readonly negativeEvidenceCount: number;
  readonly relatedEntityIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MemoryRepository {
  listRecords(input: {
    readonly ownerId: string;
    readonly kind?: DurableMemoryRecord['kind'];
    readonly activeOnly?: boolean;
  }): Promise<readonly DurableMemoryRecord[]>;
  findRecord(input: {
    readonly ownerId: string;
    readonly memoryRecordId: string;
  }): Promise<DurableMemoryRecord | undefined>;
  saveRecord(record: DurableMemoryRecord): Promise<void>;
  saveCandidate(candidate: MemoryCandidate): Promise<void>;
  findCandidate(input: {
    readonly ownerId: string;
    readonly candidateId: string;
  }): Promise<MemoryCandidate | undefined>;
  saveEvidence(evidence: MemoryEvidence): Promise<void>;
  linkRecords(input: {
    readonly ownerId: string;
    readonly fromMemoryRecordId: string;
    readonly toMemoryRecordId: string;
    readonly relation: string;
    readonly now: string;
  }): Promise<void>;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

function assertOwner(actorOwnerId: string, ownerId: string): void {
  if (actorOwnerId !== ownerId) {
    throw new Error('Memory changes must be owner-scoped.');
  }
}

/**
 * Structured memory service. Candidates and durable records are intentionally separate: durable
 * state only changes through deterministic promotion and an owner-scoped review operation.
 */
export class MemoryService {
  public constructor(private readonly repository: MemoryRepository) {}

  public async retrieveRelevantMemory(input: {
    readonly ownerId: string;
    readonly entityIds: readonly string[];
    readonly kinds?: readonly DurableMemoryRecord['kind'][];
  }): Promise<readonly DurableMemoryRecord[]> {
    const all = await this.repository.listRecords({ ownerId: input.ownerId, activeOnly: true });
    const kinds = input.kinds ? new Set(input.kinds) : undefined;
    const entityIds = new Set(input.entityIds);
    return all.filter(
      (record) =>
        (!kinds || kinds.has(record.kind)) &&
        (entityIds.size === 0 || record.relatedEntityIds.some((id) => entityIds.has(id))),
    );
  }

  public async retrieveByType(
    ownerId: string,
    kind: DurableMemoryRecord['kind'],
  ): Promise<readonly DurableMemoryRecord[]> {
    return this.repository.listRecords({ ownerId, kind, activeOnly: true });
  }

  public async retrieveByEntity(
    ownerId: string,
    entityId: string,
  ): Promise<readonly DurableMemoryRecord[]> {
    return this.retrieveRelevantMemory({ ownerId, entityIds: [entityId] });
  }

  public async retrieveActiveFacts(ownerId: string): Promise<readonly DurableMemoryRecord[]> {
    return this.retrieveByType(ownerId, 'fact');
  }

  public async retrieveOpenLoops(ownerId: string): Promise<readonly DurableMemoryRecord[]> {
    return this.retrieveByType(ownerId, 'open_loop');
  }

  public async createMemoryCandidate(candidate: MemoryCandidate): Promise<MemoryCandidate> {
    const rule = evaluateMemoryPromotion(candidate);
    const normalized: MemoryCandidate = {
      ...candidate,
      kind: rule.effectiveKind,
      requiresOwnerConfirmation: rule.requiresOwnerConfirmation,
      state: 'pending_review',
      confidenceBasisPoints: clampConfidence(
        Math.min(candidate.confidenceBasisPoints, authorityWeight(candidate.authority)),
      ),
      updatedAt: new Date().toISOString(),
    };
    await this.repository.saveCandidate(normalized);
    return normalized;
  }

  public async confirmCandidate(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly candidateId: string;
  }): Promise<DurableMemoryRecord> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const candidate = await this.requireCandidate(input.ownerId, input.candidateId);
    if (candidate.kind === 'constitution_candidate') {
      throw new Error(
        'A constitution candidate must use ConstitutionService and explicit activation.',
      );
    }
    const now = new Date().toISOString();
    const record: DurableMemoryRecord = {
      id: randomUUID(),
      ownerId: candidate.ownerId,
      kind: candidate.kind,
      statement: candidate.normalizedStatement,
      source: candidate.authority,
      confidenceBasisPoints: clampConfidence(Math.max(candidate.confidenceBasisPoints, 7_500)),
      sensitivity: candidate.sensitivity,
      validFrom: candidate.validFrom,
      validTo: candidate.validTo,
      reviewAt: candidate.reviewAt,
      reviewedAt: now,
      active: true,
      evidenceCount: candidate.evidenceIds.length,
      positiveEvidenceCount: candidate.evidenceIds.length,
      negativeEvidenceCount: 0,
      relatedEntityIds: candidate.relatedEntityIds,
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.saveRecord(record);
    await this.repository.saveCandidate({ ...candidate, state: 'confirmed', updatedAt: now });
    return record;
  }

  public async rejectCandidate(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly candidateId: string;
  }): Promise<void> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const candidate = await this.requireCandidate(input.ownerId, input.candidateId);
    await this.repository.saveCandidate({
      ...candidate,
      state: 'rejected',
      updatedAt: new Date().toISOString(),
    });
  }

  public async supersedeMemory(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly memoryRecordId: string;
    readonly supersedingMemoryRecordId: string;
  }): Promise<void> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const oldRecord = await this.requireRecord(input.ownerId, input.memoryRecordId);
    await this.requireRecord(input.ownerId, input.supersedingMemoryRecordId);
    await this.repository.saveRecord({
      ...oldRecord,
      active: false,
      updatedAt: new Date().toISOString(),
    });
  }

  public async deactivateMemory(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly memoryRecordId: string;
  }): Promise<void> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const record = await this.requireRecord(input.ownerId, input.memoryRecordId);
    await this.repository.saveRecord({
      ...record,
      active: false,
      updatedAt: new Date().toISOString(),
    });
  }

  public async reviewStaleMemory(input: {
    readonly ownerId: string;
    readonly now: string;
  }): Promise<readonly DurableMemoryRecord[]> {
    const records = await this.repository.listRecords({ ownerId: input.ownerId, activeOnly: true });
    const nowMs = Date.parse(input.now);
    return records.filter(
      (record) => record.reviewAt !== null && Date.parse(record.reviewAt) <= nowMs,
    );
  }

  public async linkMemories(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly fromMemoryRecordId: string;
    readonly toMemoryRecordId: string;
    readonly relation: string;
  }): Promise<void> {
    assertOwner(input.actorOwnerId, input.ownerId);
    await this.requireRecord(input.ownerId, input.fromMemoryRecordId);
    await this.requireRecord(input.ownerId, input.toMemoryRecordId);
    await this.repository.linkRecords({ ...input, now: new Date().toISOString() });
  }

  public async recordEvidence(input: {
    readonly ownerId: string;
    readonly memoryRecordId: string;
    readonly evidenceRecordId: string;
    readonly authority: MemoryAuthority;
    readonly positive: boolean;
    readonly observedAt: string;
  }): Promise<DurableMemoryRecord> {
    const record = await this.requireRecord(input.ownerId, input.memoryRecordId);
    const delta =
      Math.max(100, Math.floor(authorityWeight(input.authority) / 20)) * (input.positive ? 1 : -1);
    const updated: DurableMemoryRecord = {
      ...record,
      confidenceBasisPoints: clampConfidence(record.confidenceBasisPoints + delta),
      evidenceCount: record.evidenceCount + 1,
      positiveEvidenceCount: record.positiveEvidenceCount + (input.positive ? 1 : 0),
      negativeEvidenceCount: record.negativeEvidenceCount + (input.positive ? 0 : 1),
      updatedAt: input.observedAt,
    };
    await this.repository.saveRecord(updated);
    await this.repository.saveEvidence({
      id: randomUUID(),
      ownerId: input.ownerId,
      memoryCandidateId: null,
      memoryRecordId: record.id,
      evidenceRecordId: input.evidenceRecordId,
      evidenceType: 'structured_reference',
      authority: input.authority,
      observedAt: input.observedAt,
      confidenceDeltaBasisPoints: input.positive ? delta : -Math.abs(delta),
      createdAt: new Date().toISOString(),
    });
    return updated;
  }

  private async requireCandidate(ownerId: string, candidateId: string): Promise<MemoryCandidate> {
    const candidate = await this.repository.findCandidate({ ownerId, candidateId });
    if (!candidate) {
      throw new Error('The requested memory candidate does not exist for this owner.');
    }
    return candidate;
  }

  private async requireRecord(
    ownerId: string,
    memoryRecordId: string,
  ): Promise<DurableMemoryRecord> {
    const record = await this.repository.findRecord({ ownerId, memoryRecordId });
    if (!record) {
      throw new Error('The requested memory record does not exist for this owner.');
    }
    return record;
  }
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly records = new Map<string, DurableMemoryRecord>();
  private readonly candidates = new Map<string, MemoryCandidate>();
  public readonly evidence: MemoryEvidence[] = [];
  public readonly links: {
    readonly ownerId: string;
    readonly fromMemoryRecordId: string;
    readonly toMemoryRecordId: string;
    readonly relation: string;
    readonly now: string;
  }[] = [];

  public async listRecords(input: {
    readonly ownerId: string;
    readonly kind?: DurableMemoryRecord['kind'];
    readonly activeOnly?: boolean;
  }): Promise<readonly DurableMemoryRecord[]> {
    return [...this.records.values()].filter(
      (record) =>
        record.ownerId === input.ownerId &&
        (!input.kind || record.kind === input.kind) &&
        (!input.activeOnly || record.active),
    );
  }
  public async findRecord(input: {
    readonly ownerId: string;
    readonly memoryRecordId: string;
  }): Promise<DurableMemoryRecord | undefined> {
    const record = this.records.get(input.memoryRecordId);
    return record?.ownerId === input.ownerId ? record : undefined;
  }
  public async saveRecord(record: DurableMemoryRecord): Promise<void> {
    this.records.set(record.id, record);
  }
  public async saveCandidate(candidate: MemoryCandidate): Promise<void> {
    this.candidates.set(candidate.id, candidate);
  }
  public async findCandidate(input: {
    readonly ownerId: string;
    readonly candidateId: string;
  }): Promise<MemoryCandidate | undefined> {
    const candidate = this.candidates.get(input.candidateId);
    return candidate?.ownerId === input.ownerId ? candidate : undefined;
  }
  public async saveEvidence(evidence: MemoryEvidence): Promise<void> {
    this.evidence.push(evidence);
  }
  public async linkRecords(input: {
    readonly ownerId: string;
    readonly fromMemoryRecordId: string;
    readonly toMemoryRecordId: string;
    readonly relation: string;
    readonly now: string;
  }): Promise<void> {
    this.links.push(input);
  }
}
