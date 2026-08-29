import { randomUUID } from 'node:crypto';

import type { ClarificationRequest, InformationState } from '@jarvis/contracts';

export interface SourceAssertion {
  readonly source: string;
  readonly valueFingerprint: string;
  readonly informationState: InformationState;
  readonly observedAt: string | null;
}

export interface SourceConflict {
  readonly id: string;
  readonly ownerId: string;
  readonly subjectType: string;
  readonly subjectReference: string;
  readonly summary: string;
  readonly state: 'open' | 'resolved';
  readonly correlationId: string;
}

export interface ConflictRepository {
  save(conflict: SourceConflict): Promise<void>;
  saveClarification(
    input: ClarificationRequest & { readonly ownerId: string; readonly correlationId: string },
  ): Promise<void>;
}

/** Records an important disagreement rather than silently choosing a source or duplicating truth. */
export class ConflictService {
  public constructor(private readonly repository: ConflictRepository) {}

  public async registerIfConflicting(input: {
    readonly ownerId: string;
    readonly subjectType: string;
    readonly subjectReference: string;
    readonly assertions: readonly SourceAssertion[];
    readonly correlationId: string;
    readonly askClarification: boolean;
  }): Promise<{
    readonly conflict: SourceConflict | null;
    readonly clarification: ClarificationRequest | null;
  }> {
    const fingerprints = new Set(input.assertions.map((assertion) => assertion.valueFingerprint));
    if (fingerprints.size <= 1) {
      return { conflict: null, clarification: null };
    }
    const conflict: SourceConflict = {
      id: randomUUID(),
      ownerId: input.ownerId,
      subjectType: input.subjectType,
      subjectReference: input.subjectReference,
      summary: `Conflicting ${input.subjectType} records from ${input.assertions
        .map((item) => item.source)
        .sort()
        .join(', ')} require review.`,
      state: 'open',
      correlationId: input.correlationId,
    };
    await this.repository.save(conflict);
    if (!input.askClarification) {
      return { conflict, clarification: null };
    }
    const clarification: ClarificationRequest = {
      question: `Which ${input.subjectType} detail should JARVIS use?`,
      reason: 'Important sources disagree, so JARVIS will not silently choose one.',
      blocking: true,
      relatedRecordIds: [],
    };
    await this.repository.saveClarification({
      ...clarification,
      ownerId: input.ownerId,
      correlationId: input.correlationId,
    });
    return { conflict, clarification };
  }
}

export class InMemoryConflictRepository implements ConflictRepository {
  public readonly conflicts: SourceConflict[] = [];
  public readonly clarifications: (ClarificationRequest & {
    readonly ownerId: string;
    readonly correlationId: string;
  })[] = [];
  public async save(conflict: SourceConflict): Promise<void> {
    this.conflicts.push(conflict);
  }
  public async saveClarification(
    input: ClarificationRequest & { readonly ownerId: string; readonly correlationId: string },
  ): Promise<void> {
    this.clarifications.push(input);
  }
}
