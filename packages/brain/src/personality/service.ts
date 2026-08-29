import { randomUUID } from 'node:crypto';

export const personalityTraitNames = [
  'message_length',
  'directness',
  'humor_tolerance',
  'profanity_tolerance',
  'praise_preference',
  'challenge_tolerance',
  'explanation_depth',
  'choice_count',
  'reminder_density',
  'morning_communication_style',
  'evening_communication_style',
] as const;

export type PersonalityTraitName = (typeof personalityTraitNames)[number];

export interface PersonalityTrait {
  readonly id: string;
  readonly ownerId: string;
  readonly trait: PersonalityTraitName;
  /** Bounded delivery preference in the range 0–100, never a value, permission, or policy. */
  readonly currentEstimate: number;
  readonly confidenceBasisPoints: number;
  readonly evidenceCount: number;
  readonly positiveEvidenceCount: number;
  readonly negativeEvidenceCount: number;
  readonly frozen: boolean;
  readonly learningEnabled: boolean;
  readonly lastUpdatedAt: string;
  readonly lastReviewedAt: string | null;
}

export interface PersonalityRepository {
  find(input: {
    readonly ownerId: string;
    readonly trait: PersonalityTraitName;
  }): Promise<PersonalityTrait | undefined>;
  save(trait: PersonalityTrait): Promise<void>;
}

function assertOwner(actorOwnerId: string, ownerId: string): void {
  if (actorOwnerId !== ownerId) {
    throw new Error('Personality delivery preferences must be changed by the owner.');
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Bounded delivery adaptation. It does not return or consume constitutional, permission, or policy
 * information, which makes it structurally unsuitable for changing values or access boundaries.
 */
export class PersonalityService {
  public constructor(private readonly repository: PersonalityRepository) {}

  public async recordEvidence(input: {
    readonly ownerId: string;
    readonly trait: PersonalityTraitName;
    readonly positive: boolean;
    readonly observedAt: string;
  }): Promise<PersonalityTrait> {
    const current = (await this.repository.find({
      ownerId: input.ownerId,
      trait: input.trait,
    })) ?? {
      id: randomUUID(),
      ownerId: input.ownerId,
      trait: input.trait,
      currentEstimate: 50,
      confidenceBasisPoints: 0,
      evidenceCount: 0,
      positiveEvidenceCount: 0,
      negativeEvidenceCount: 0,
      frozen: false,
      learningEnabled: true,
      lastUpdatedAt: input.observedAt,
      lastReviewedAt: null,
    };
    const evidenceCount = current.evidenceCount + 1;
    const positiveEvidenceCount = current.positiveEvidenceCount + (input.positive ? 1 : 0);
    const negativeEvidenceCount = current.negativeEvidenceCount + (input.positive ? 0 : 1);
    const eligibleToShift = current.learningEnabled && !current.frozen && evidenceCount >= 3;
    // A single emotional message adds traceable evidence but does not move the estimate.
    const shift = eligibleToShift ? (input.positive ? 4 : -4) : 0;
    const updated: PersonalityTrait = {
      ...current,
      currentEstimate: clamp(current.currentEstimate + shift),
      confidenceBasisPoints: Math.min(9_000, evidenceCount * 750),
      evidenceCount,
      positiveEvidenceCount,
      negativeEvidenceCount,
      lastUpdatedAt: input.observedAt,
    };
    await this.repository.save(updated);
    return updated;
  }

  public async freezeTrait(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly trait: PersonalityTraitName;
    readonly frozen: boolean;
  }): Promise<PersonalityTrait> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const current = await this.require(input.ownerId, input.trait);
    const updated = { ...current, frozen: input.frozen, lastReviewedAt: new Date().toISOString() };
    await this.repository.save(updated);
    return updated;
  }

  public async resetTrait(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly trait: PersonalityTraitName;
  }): Promise<PersonalityTrait> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const current = await this.require(input.ownerId, input.trait);
    const now = new Date().toISOString();
    const updated: PersonalityTrait = {
      ...current,
      currentEstimate: 50,
      confidenceBasisPoints: 0,
      evidenceCount: 0,
      positiveEvidenceCount: 0,
      negativeEvidenceCount: 0,
      frozen: false,
      lastUpdatedAt: now,
      lastReviewedAt: now,
    };
    await this.repository.save(updated);
    return updated;
  }

  public async manuallyEditTrait(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly trait: PersonalityTraitName;
    readonly estimate: number;
  }): Promise<PersonalityTrait> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const current = await this.require(input.ownerId, input.trait);
    const now = new Date().toISOString();
    const updated = {
      ...current,
      currentEstimate: clamp(input.estimate),
      confidenceBasisPoints: 10_000,
      lastUpdatedAt: now,
      lastReviewedAt: now,
    };
    await this.repository.save(updated);
    return updated;
  }

  public async disableLearning(input: {
    readonly ownerId: string;
    readonly actorOwnerId: string;
    readonly trait: PersonalityTraitName;
    readonly disabled: boolean;
  }): Promise<PersonalityTrait> {
    assertOwner(input.actorOwnerId, input.ownerId);
    const current = await this.require(input.ownerId, input.trait);
    const updated = {
      ...current,
      learningEnabled: !input.disabled,
      lastReviewedAt: new Date().toISOString(),
    };
    await this.repository.save(updated);
    return updated;
  }

  private async require(ownerId: string, trait: PersonalityTraitName): Promise<PersonalityTrait> {
    const record = await this.repository.find({ ownerId, trait });
    if (!record) {
      throw new Error('The requested personality trait does not exist for this owner.');
    }
    return record;
  }
}

export class InMemoryPersonalityRepository implements PersonalityRepository {
  private readonly traits = new Map<string, PersonalityTrait>();
  public async find(input: {
    readonly ownerId: string;
    readonly trait: PersonalityTraitName;
  }): Promise<PersonalityTrait | undefined> {
    return this.traits.get(`${input.ownerId}:${input.trait}`);
  }
  public async save(trait: PersonalityTrait): Promise<void> {
    this.traits.set(`${trait.ownerId}:${trait.trait}`, trait);
  }
}
