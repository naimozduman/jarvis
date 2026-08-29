import { randomUUID } from 'node:crypto';

export interface HardOverride {
  readonly id: string;
  readonly ownerId: string;
  readonly statement: string;
  readonly scope: string;
  readonly relatedEntityIds: readonly string[];
  readonly temporary: boolean;
  readonly reason: string | null;
  readonly activeFrom: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly consequenceExplainedAt: string | null;
  readonly correlationId: string;
}

export interface HardOverrideRepository {
  save(override: HardOverride): Promise<void>;
  list(input: { readonly ownerId: string }): Promise<readonly HardOverride[]>;
}

/** Explicit, auditable owner choices outrank preferences and hypotheses but never security policy. */
export class HardOverrideService {
  public constructor(private readonly repository: HardOverrideRepository) {}

  public async recordExplicitOwnerOverride(input: {
    readonly ownerId: string;
    readonly statement: string;
    readonly scope: string;
    readonly relatedEntityIds: readonly string[];
    readonly temporary: boolean;
    readonly reason: string | null;
    readonly activeFrom: string;
    readonly expiresAt: string | null;
    readonly correlationId: string;
  }): Promise<HardOverride> {
    if (input.temporary && input.expiresAt === null) {
      throw new Error('A temporary hard override requires an explicit expiry time.');
    }
    const override: HardOverride = {
      id: randomUUID(),
      ownerId: input.ownerId,
      statement: input.statement,
      scope: input.scope,
      relatedEntityIds: [...new Set(input.relatedEntityIds)],
      temporary: input.temporary,
      reason: input.reason,
      activeFrom: input.activeFrom,
      expiresAt: input.expiresAt,
      revokedAt: null,
      consequenceExplainedAt: null,
      correlationId: input.correlationId,
    };
    await this.repository.save(override);
    return override;
  }

  public async activeFor(input: {
    readonly ownerId: string;
    readonly now: string;
    readonly entityId?: string;
  }): Promise<readonly HardOverride[]> {
    const nowMs = Date.parse(input.now);
    const overrides = await this.repository.list({ ownerId: input.ownerId });
    return overrides.filter(
      (override) =>
        override.revokedAt === null &&
        Date.parse(override.activeFrom) <= nowMs &&
        (override.expiresAt === null || Date.parse(override.expiresAt) > nowMs) &&
        (input.entityId === undefined || override.relatedEntityIds.includes(input.entityId)),
    );
  }

  public async markConsequenceExplained(input: {
    readonly ownerId: string;
    readonly overrideId: string;
    readonly at: string;
  }): Promise<boolean> {
    const overrides = await this.repository.list({ ownerId: input.ownerId });
    const override = overrides.find((item) => item.id === input.overrideId);
    if (!override || override.consequenceExplainedAt !== null) {
      return false;
    }
    await this.repository.save({ ...override, consequenceExplainedAt: input.at });
    return true;
  }

  public async revoke(input: {
    readonly ownerId: string;
    readonly overrideId: string;
    readonly revokedAt: string;
  }): Promise<void> {
    const overrides = await this.repository.list({ ownerId: input.ownerId });
    const override = overrides.find((item) => item.id === input.overrideId);
    if (!override) {
      throw new Error('The requested hard override does not exist for this owner.');
    }
    await this.repository.save({ ...override, revokedAt: input.revokedAt });
  }
}

export class InMemoryHardOverrideRepository implements HardOverrideRepository {
  private readonly overrides = new Map<string, HardOverride>();
  public async save(override: HardOverride): Promise<void> {
    this.overrides.set(override.id, override);
  }
  public async list(input: { readonly ownerId: string }): Promise<readonly HardOverride[]> {
    return [...this.overrides.values()].filter((override) => override.ownerId === input.ownerId);
  }
}
