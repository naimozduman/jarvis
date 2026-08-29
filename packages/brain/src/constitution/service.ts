import { randomUUID } from 'node:crypto';

export type ConstitutionFlexibility = 'fixed' | 'flexible' | 'negotiable';

export interface ConstitutionVersion {
  readonly id: string;
  readonly ownerId: string;
  readonly constitutionItemId: string;
  readonly version: number;
  readonly principle: string;
  readonly priority: number;
  readonly flexibility: ConstitutionFlexibility;
  readonly source: 'owner' | 'onboarding_review' | 'model_candidate';
  readonly changeReason: string;
  readonly active: boolean;
  readonly isCurrent: boolean;
  readonly reviewDate: string | null;
  readonly createdAt: string;
}

export interface ConstitutionItem {
  readonly id: string;
  readonly ownerId: string;
  readonly category: string;
  readonly active: boolean;
  readonly currentVersion: number;
  readonly reviewDate: string | null;
  readonly versions: readonly ConstitutionVersion[];
}

export interface ConstitutionDraftInput {
  readonly ownerId: string;
  readonly category: string;
  readonly principle: string;
  readonly priority: number;
  readonly flexibility: ConstitutionFlexibility;
  readonly reviewDate: string | null;
  readonly changeReason: string;
  readonly source: 'owner' | 'onboarding_review' | 'model_candidate';
}

export interface ConstitutionRepository {
  createItemWithDraft(
    input: ConstitutionDraftInput & {
      readonly itemId: string;
      readonly versionId: string;
      readonly now: string;
    },
  ): Promise<ConstitutionItem>;
  findItem(input: {
    readonly ownerId: string;
    readonly itemId: string;
  }): Promise<ConstitutionItem | undefined>;
  listActive(input: { readonly ownerId: string }): Promise<readonly ConstitutionItem[]>;
  saveItem(item: ConstitutionItem): Promise<void>;
}

function assertOwner(actorOwnerId: string, ownerId: string): void {
  if (actorOwnerId !== ownerId) {
    throw new Error('Only the owning identity may review or change constitutional values.');
  }
}

function currentVersion(item: ConstitutionItem): ConstitutionVersion {
  const version = item.versions.find((candidate) => candidate.isCurrent);
  if (!version) {
    throw new Error('A constitution item must retain one current version.');
  }
  return version;
}

/**
 * Constitutional value changes are an owner-only, versioned workflow. There is intentionally no
 * method that accepts a model decision and activates it; a model can only create a draft candidate.
 */
export class ConstitutionService {
  public constructor(private readonly repository: ConstitutionRepository) {}

  public async createDraft(input: ConstitutionDraftInput): Promise<ConstitutionItem> {
    const now = new Date().toISOString();
    return this.repository.createItemWithDraft({
      ...input,
      itemId: randomUUID(),
      versionId: randomUUID(),
      now,
    });
  }

  public async reviewItem(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly itemId: string;
  }): Promise<ConstitutionItem> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const item = await this.requireItem(input.ownerId, input.itemId);
    return item;
  }

  public async activateVersion(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly itemId: string;
    readonly versionId: string;
  }): Promise<ConstitutionItem> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const item = await this.requireItem(input.ownerId, input.itemId);
    const desired = item.versions.find((version) => version.id === input.versionId);
    if (!desired) {
      throw new Error(
        'An owner may only activate a draft version belonging to the requested item.',
      );
    }
    const updated: ConstitutionItem = {
      ...item,
      active: true,
      currentVersion: desired.version,
      reviewDate: desired.reviewDate,
      versions: item.versions.map((version) => ({
        ...version,
        active: version.id === desired.id,
        isCurrent: version.id === desired.id,
      })),
    };
    await this.repository.saveItem(updated);
    return updated;
  }

  public async replaceVersion(
    input: ConstitutionDraftInput & {
      readonly actorOwnerId: string;
      readonly itemId: string;
    },
  ): Promise<ConstitutionItem> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const item = await this.requireItem(input.ownerId, input.itemId);
    const now = new Date().toISOString();
    const nextVersion: ConstitutionVersion = {
      id: randomUUID(),
      ownerId: item.ownerId,
      constitutionItemId: item.id,
      version: Math.max(...item.versions.map((version) => version.version)) + 1,
      principle: input.principle,
      priority: input.priority,
      flexibility: input.flexibility,
      source: input.source,
      changeReason: input.changeReason,
      active: false,
      isCurrent: false,
      reviewDate: input.reviewDate,
      createdAt: now,
    };
    const updated = { ...item, versions: [...item.versions, nextVersion] };
    await this.repository.saveItem(updated);
    return updated;
  }

  public async deactivateItem(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly itemId: string;
  }): Promise<ConstitutionItem> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const item = await this.requireItem(input.ownerId, input.itemId);
    const updated = { ...item, active: false };
    await this.repository.saveItem(updated);
    return updated;
  }

  public async scheduleReview(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly itemId: string;
    readonly reviewDate: string;
  }): Promise<ConstitutionItem> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const item = await this.requireItem(input.ownerId, input.itemId);
    const updated: ConstitutionItem = {
      ...item,
      reviewDate: input.reviewDate,
      versions: item.versions.map((version) =>
        version.isCurrent ? { ...version, reviewDate: input.reviewDate } : version,
      ),
    };
    await this.repository.saveItem(updated);
    return updated;
  }

  public async listActive(ownerId: string): Promise<readonly ConstitutionItem[]> {
    return this.repository.listActive({ ownerId });
  }

  public async relevantToDecision(input: {
    readonly ownerId: string;
    readonly categories: readonly string[];
  }): Promise<readonly ConstitutionItem[]> {
    const categorySet = new Set(input.categories.map((category) => category.toLocaleLowerCase()));
    const active = await this.listActive(input.ownerId);
    return active.filter(
      (item) => categorySet.size === 0 || categorySet.has(item.category.toLocaleLowerCase()),
    );
  }

  public current(item: ConstitutionItem): ConstitutionVersion {
    return currentVersion(item);
  }

  private async requireItem(ownerId: string, itemId: string): Promise<ConstitutionItem> {
    const item = await this.repository.findItem({ ownerId, itemId });
    if (!item) {
      throw new Error('The requested constitution item does not exist for this owner.');
    }
    return item;
  }
}

/** Lightweight deterministic test adapter; production adapters belong to @jarvis/database. */
export class InMemoryConstitutionRepository implements ConstitutionRepository {
  private readonly items = new Map<string, ConstitutionItem>();

  public async createItemWithDraft(
    input: ConstitutionDraftInput & {
      readonly itemId: string;
      readonly versionId: string;
      readonly now: string;
    },
  ): Promise<ConstitutionItem> {
    const draft: ConstitutionVersion = {
      id: input.versionId,
      ownerId: input.ownerId,
      constitutionItemId: input.itemId,
      version: 1,
      principle: input.principle,
      priority: input.priority,
      flexibility: input.flexibility,
      source: input.source,
      changeReason: input.changeReason,
      active: false,
      isCurrent: true,
      reviewDate: input.reviewDate,
      createdAt: input.now,
    };
    const item: ConstitutionItem = {
      id: input.itemId,
      ownerId: input.ownerId,
      category: input.category,
      active: false,
      currentVersion: 1,
      reviewDate: input.reviewDate,
      versions: [draft],
    };
    this.items.set(item.id, item);
    return item;
  }

  public async findItem(input: {
    readonly ownerId: string;
    readonly itemId: string;
  }): Promise<ConstitutionItem | undefined> {
    const item = this.items.get(input.itemId);
    return item?.ownerId === input.ownerId ? item : undefined;
  }

  public async listActive(input: {
    readonly ownerId: string;
  }): Promise<readonly ConstitutionItem[]> {
    return [...this.items.values()].filter((item) => item.ownerId === input.ownerId && item.active);
  }

  public async saveItem(item: ConstitutionItem): Promise<void> {
    this.items.set(item.id, item);
  }
}
