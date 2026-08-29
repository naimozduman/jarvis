import { desc, eq } from 'drizzle-orm';

import type { JarvisDatabase } from './client.js';
import { interventionDefinitions, interventionOutcomes, interventionRuns } from './schema/index.js';

/**
 * Deliberately structural port types: @jarvis/database does not import @jarvis/brain, so the
 * brain package can depend on this adapter without creating a package cycle.
 */
export interface PersistedInterventionDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly purpose: string;
  readonly triggerConditions: readonly string[];
  readonly contraindications: readonly string[];
  readonly requiredContext: readonly string[];
  readonly example: string;
  readonly cooldownMinutes: number;
  readonly successSignal: string;
  readonly failureSignal: string;
  readonly cost: string;
  readonly applicableDomains: readonly string[];
}

export interface PersistedInterventionRun {
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

export interface PersistedInterventionOutcome {
  readonly ownerId: string;
  readonly interventionRunId: string;
  readonly outcome: 'started' | 'completed' | 'not_started' | 'declined' | 'unknown';
  readonly observedAt: string;
  readonly contextKey: string;
  readonly note: string | null;
}

/** Durable adapter for the seeded, versioned intervention library and descriptive outcomes. */
export class DrizzleInterventionRepository {
  public constructor(private readonly database: JarvisDatabase) {}

  public async listHistory(input: { readonly ownerId: string }): Promise<
    readonly {
      readonly interventionId: string;
      readonly contextKey: string;
      readonly cooldownUntil: string | null;
    }[]
  > {
    const runs = await this.database
      .select({
        interventionId: interventionRuns.interventionDefinitionId,
        contextKey: interventionRuns.contextKey,
        cooldownUntil: interventionRuns.cooldownUntil,
      })
      .from(interventionRuns)
      .where(eq(interventionRuns.ownerId, input.ownerId))
      .orderBy(desc(interventionRuns.createdAt));
    return runs.map((run) => ({
      interventionId: run.interventionId,
      contextKey: run.contextKey,
      cooldownUntil: run.cooldownUntil?.toISOString() ?? null,
    }));
  }

  public async persistProposedRun(input: {
    readonly run: PersistedInterventionRun;
    readonly definition: PersistedInterventionDefinition;
  }): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction
        .insert(interventionDefinitions)
        .values({
          id: input.definition.id,
          name: input.definition.name,
          version: input.definition.version,
          purpose: input.definition.purpose,
          triggerConditions: [...input.definition.triggerConditions],
          contraindications: [...input.definition.contraindications],
          requiredContext: [...input.definition.requiredContext],
          example: input.definition.example,
          cooldownMinutes: input.definition.cooldownMinutes,
          successSignal: input.definition.successSignal,
          failureSignal: input.definition.failureSignal,
          cost: input.definition.cost,
          applicableDomains: [...input.definition.applicableDomains],
          active: true,
        })
        .onConflictDoNothing();
      await transaction.insert(interventionRuns).values({
        id: input.run.id,
        ownerId: input.run.ownerId,
        interventionDefinitionId: input.run.interventionId,
        commitmentId: input.run.commitmentId ?? undefined,
        sourceBrainDecisionId: input.run.sourceBrainDecisionId,
        contextKey: input.run.contextKey,
        contextSummary: input.run.contextSummary,
        state: input.run.state,
        cooldownUntil: input.run.cooldownUntil ? new Date(input.run.cooldownUntil) : undefined,
        correlationId: input.run.correlationId,
        createdAt: new Date(input.run.createdAt),
        updatedAt: new Date(input.run.createdAt),
      });
    });
  }

  public async recordOutcome(outcome: PersistedInterventionOutcome): Promise<void> {
    await this.database.insert(interventionOutcomes).values({
      ownerId: outcome.ownerId,
      interventionRunId: outcome.interventionRunId,
      outcome: outcome.outcome,
      observedAt: new Date(outcome.observedAt),
      contextKey: outcome.contextKey,
      note: outcome.note ?? undefined,
    });
  }
}
