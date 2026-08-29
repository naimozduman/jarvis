import type { MessagingTransportHealth } from '@jarvis/contracts';

import type { EvolutionMessagingTransport } from './adapter.js';

/**
 * Health is deliberately split from core readiness. A disconnected/blocked WhatsApp transport
 * must be visible, but it cannot make JARVIS's canonical PostgreSQL/Brain core claim corruption.
 */
export class EvolutionHealthCheck {
  public constructor(
    private readonly transport: EvolutionMessagingTransport,
    private readonly connectionId: string,
    private readonly configured: boolean,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async check(): Promise<MessagingTransportHealth> {
    const checkedAt = this.now().toISOString();
    if (!this.configured) {
      return {
        transport: 'evolution_whatsapp',
        configured: false,
        versionVerified: false,
        reachable: false,
        authenticated: false,
        connected: false,
        state: 'disabled',
        safeErrorCategory: 'not_configured',
        checkedAt,
      };
    }
    const gate = this.transport.versionGate;
    if (!gate.verified) {
      return {
        transport: 'evolution_whatsapp',
        configured: true,
        versionVerified: false,
        reachable: false,
        authenticated: false,
        connected: false,
        state: gate.reason === 'vulnerable_baileys' ? 'incompatible_dependency' : 'blocked',
        safeErrorCategory: gate.reason,
        checkedAt,
      };
    }
    const status = await this.transport.getConnectionStatus({ connectionId: this.connectionId });
    return {
      transport: 'evolution_whatsapp',
      configured: true,
      versionVerified: true,
      reachable: status.safeErrorCategory === null,
      // A state query only proves reachability. Treat an account as authenticated only when the
      // reviewed provider reports an active/degraded session; QR, logout, disconnect, and retry
      // states remain conservatively false rather than inferring authentication from a response.
      authenticated: status.state === 'connected' || status.state === 'degraded',
      connected: status.state === 'connected',
      state: status.state,
      safeErrorCategory: status.safeErrorCategory,
      checkedAt: status.checkedAt,
    };
  }
}
