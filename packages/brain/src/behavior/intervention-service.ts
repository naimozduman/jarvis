import { randomUUID } from 'node:crypto';

import type { InterventionProposal } from '@jarvis/contracts';

import {
  InterventionRegistry,
  type InterventionDefinition,
  type InterventionOutcome,
  type InterventionRunHistory,
} from './intervention-registry.js';

export interface InterventionRun {
  readonly id: string;
  readonly ownerId: string;
  readonly interventionId: string;
  readonly commitmentId: string | null;
  readonly sourceBrainDecisionId: string;
  readonly contextKey: string;
  readonly contextSummary: string;
  readonly state: 'proposed' | 'suppressed';
  readonly cooldownUntil: string | null;
  readonly correlationId: string;
  readonly createdAt: string;
}

export interface InterventionRepository {
  listHistory(input: { readonly ownerId: string }): Promise<readonly InterventionRunHistory[]>;
  persistProposedRun(input: {
    readonly run: InterventionRun;
    readonly definition: InterventionDefinition;
  }): Promise<void>;
  recordOutcome(outcome: InterventionOutcome): Promise<void>;
}

export type InterventionProposalResult =
  | { readonly state: 'proposed'; readonly run: InterventionRun }
  | { readonly state: 'suppressed'; readonly reason: string };

/**
 * Applies the reviewable tactic registry before persistence. This service deliberately reports
 * observed outcomes only; it never infers clinical efficacy or causal effect from those outcomes.
 */
export class InterventionService {
  public constructor(
    private readonly repository: InterventionRepository,
    private readonly registry: InterventionRegistry = new InterventionRegistry(),
  ) {}

  public isSupported(interventionId: string): boolean {
    return this.registry.get(interventionId) !== undefined;
  }

  public async propose(input: {
    readonly ownerId: string;
    readonly proposal: InterventionProposal;
    readonly sourceBrainDecisionId: string;
    readonly correlationId: string;
    readonly now: string;
  }): Promise<InterventionProposalResult> {
    const definition = this.registry.get(input.proposal.interventionId);
    if (!definition) {
      throw new Error('The requested behavioral intervention is not in the approved registry.');
    }

    const history = await this.repository.listHistory({ ownerId: input.ownerId });
    if (
      !this.registry.canRun({
        interventionId: definition.id,
        now: input.now,
        history,
      })
    ) {
      return {
        state: 'suppressed',
        reason: 'The selected intervention is still in its configured cooldown period.',
      };
    }

    const cooldownUntil = new Date(
      Date.parse(input.now) + definition.cooldownMinutes * 60_000,
    ).toISOString();
    const run: InterventionRun = {
      id: randomUUID(),
      ownerId: input.ownerId,
      interventionId: definition.id,
      commitmentId: input.proposal.commitmentId,
      sourceBrainDecisionId: input.sourceBrainDecisionId,
      contextKey: input.proposal.contextKey,
      contextSummary: input.proposal.purpose,
      state: 'proposed',
      cooldownUntil,
      correlationId: input.correlationId,
      createdAt: input.now,
    };
    await this.repository.persistProposedRun({ run, definition });
    return { state: 'proposed', run };
  }

  public async recordObservedOutcome(outcome: InterventionOutcome): Promise<void> {
    await this.repository.recordOutcome(outcome);
  }
}

export class InMemoryInterventionRepository implements InterventionRepository {
  public readonly runs: InterventionRun[] = [];
  public readonly outcomes: InterventionOutcome[] = [];

  public async listHistory(input: {
    readonly ownerId: string;
  }): Promise<readonly InterventionRunHistory[]> {
    return this.runs
      .filter((run) => run.ownerId === input.ownerId)
      .map((run) => ({
        interventionId: run.interventionId,
        contextKey: run.contextKey,
        cooldownUntil: run.cooldownUntil,
      }));
  }

  public async persistProposedRun(input: {
    readonly run: InterventionRun;
    readonly definition: InterventionDefinition;
  }): Promise<void> {
    // Referencing the definition here keeps the in-memory adapter behavior aligned with the
    // database adapter, which first ensures this versioned registry definition exists.
    void input.definition;
    this.runs.push(input.run);
  }

  public async recordOutcome(outcome: InterventionOutcome): Promise<void> {
    this.outcomes.push(outcome);
  }
}
