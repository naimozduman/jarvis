import type { IncomingEventEnvelope, ProposedAction } from '@jarvis/contracts';

export const futureConnectorKinds = [
  'evolution_whatsapp',
  'gmail',
  'google_calendar',
  'plaid',
  'whoop',
  'iron_and_intervals',
  'food_logging',
  'ios_healthkit',
  'hermes',
] as const;

export type FutureConnectorKind = (typeof futureConnectorKinds)[number];

export interface ConnectorAccountReference {
  readonly connectorKind: FutureConnectorKind;
  readonly connectorAccountId: string;
  readonly ownerId: string;
}

export interface ConnectorHealth {
  readonly configured: boolean;
  readonly connected: boolean;
  readonly lastReconciledAt: string | undefined;
  readonly detail: string;
}

export interface ConnectorExecutionRequest {
  readonly account: ConnectorAccountReference;
  readonly proposedAction: ProposedAction;
  readonly operationKey: string;
}

export interface ConnectorExecutionResult {
  readonly externalReferenceId: string | undefined;
  readonly status: 'completed' | 'pending_reconciliation' | 'failed';
  readonly safeMetadata: Readonly<Record<string, unknown>>;
}

/**
 * Future provider adapters normalize untrusted input and execute only after policy/approval. No
 * Phase 1 adapter implements this port or receives a credential.
 */
export interface ConnectorPort {
  readonly kind: FutureConnectorKind;
  normalizeIncomingEvent(input: unknown): Promise<IncomingEventEnvelope>;
  reconcile(account: ConnectorAccountReference): Promise<readonly IncomingEventEnvelope[]>;
  getHealth(account: ConnectorAccountReference): Promise<ConnectorHealth>;
  execute(request: ConnectorExecutionRequest): Promise<ConnectorExecutionResult>;
}
