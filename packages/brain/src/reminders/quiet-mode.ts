import { randomUUID } from 'node:crypto';

import type { QuietMode } from '@jarvis/contracts';

export interface QuietModeRepository {
  listActive(input: { readonly ownerId: string }): Promise<readonly QuietMode[]>;
  save(mode: QuietMode): Promise<void>;
}

export class QuietModeService {
  public constructor(private readonly repository: QuietModeRepository) {}

  public async enable(input: {
    readonly ownerId: string;
    readonly startsAt: string;
    readonly endsAt: string | null;
    readonly reviewAt: string | null;
    readonly reason: string | null;
  }): Promise<QuietMode> {
    const mode: QuietMode = {
      id: randomUUID(),
      ownerId: input.ownerId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      reviewAt: input.reviewAt,
      reason: input.reason,
      active: true,
    };
    await this.repository.save(mode);
    return mode;
  }

  public async disable(input: {
    readonly ownerId: string;
    readonly modeId: string;
  }): Promise<void> {
    const active = await this.repository.listActive({ ownerId: input.ownerId });
    const mode = active.find((item) => item.id === input.modeId);
    if (!mode) {
      throw new Error('The requested quiet mode is not active for this owner.');
    }
    await this.repository.save({ ...mode, active: false });
  }

  public async isActive(ownerId: string, now: string): Promise<boolean> {
    const nowMs = Date.parse(now);
    const modes = await this.repository.listActive({ ownerId });
    return modes.some(
      (mode) =>
        Date.parse(mode.startsAt) <= nowMs &&
        (mode.endsAt === null || Date.parse(mode.endsAt) > nowMs),
    );
  }
}

export class InMemoryQuietModeRepository implements QuietModeRepository {
  private readonly modes = new Map<string, QuietMode>();
  public async listActive(input: { readonly ownerId: string }): Promise<readonly QuietMode[]> {
    return [...this.modes.values()].filter((mode) => mode.ownerId === input.ownerId && mode.active);
  }
  public async save(mode: QuietMode): Promise<void> {
    this.modes.set(mode.id, mode);
  }
}
