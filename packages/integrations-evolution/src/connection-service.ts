import type { EvolutionClient } from './client.js';
import { verifyEvolutionVersionGate, type EvolutionVersionEvidence } from './version-gate.js';

export interface EvolutionConnectionServiceOptions {
  readonly client: EvolutionClient;
  readonly instanceName: string;
  readonly versionEvidence: EvolutionVersionEvidence;
  readonly now?: () => Date;
}

export interface EphemeralEvolutionPairingState {
  readonly state: 'qr_required' | 'connected' | 'connecting' | 'unknown';
  /** Sensitive and intentionally non-persistable. Do not log or pass this into Brain context. */
  readonly qrCode: string | null;
  /** The caller must present it only through authenticated owner/admin UI and discard at expiry. */
  readonly expiresAt: string | null;
}

/**
 * Backend-only pairing/control boundary. App boot, webhooks, workers, and tests never invoke
 * requestPairing automatically. A future authenticated admin endpoint must add its own owner
 * authentication, authorization, audit, and no-cache response handling before calling it.
 */
export class EvolutionConnectionService {
  private readonly now: () => Date;

  public constructor(private readonly options: EvolutionConnectionServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  public async requestPairing(): Promise<EphemeralEvolutionPairingState> {
    this.requireVerifiedGate();
    const result = await this.options.client.requestPairing(this.options.instanceName);
    const normalized = result.state?.toLowerCase();
    const state =
      result.qrCode !== null
        ? 'qr_required'
        : normalized === 'open' || normalized === 'connected'
          ? 'connected'
          : normalized === 'connecting'
            ? 'connecting'
            : 'unknown';
    return {
      state,
      qrCode: result.qrCode,
      expiresAt: result.qrCode ? new Date(this.now().getTime() + 60_000).toISOString() : null,
    };
  }

  /**
   * Explicit future-admin operation only. It creates a dedicated JARVIS Baileys instance with
   * history sync disabled; it does not pair a phone or persist a QR/session payload.
   */
  public async createInstance(): Promise<void> {
    this.requireVerifiedGate();
    await this.options.client.createInstance({ instanceName: this.options.instanceName });
  }

  public async reconnect(): Promise<void> {
    this.requireVerifiedGate();
    await this.options.client.restartInstance(this.options.instanceName);
  }

  public async logout(): Promise<void> {
    this.requireVerifiedGate();
    await this.options.client.logoutInstance(this.options.instanceName);
  }

  /** Removes Evolution-owned session infrastructure only; canonical JARVIS state is untouched. */
  public async removeSession(): Promise<void> {
    this.requireVerifiedGate();
    await this.options.client.deleteInstance(this.options.instanceName);
  }

  private requireVerifiedGate(): void {
    const gate = verifyEvolutionVersionGate(this.options.versionEvidence);
    if (!gate.verified) {
      throw new Error(`Evolution control-plane gate is closed: ${gate.reason}.`);
    }
  }
}
