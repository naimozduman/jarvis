export interface IntegrationFoundationStatus {
  readonly status: 'not_initialized';
  readonly detail: 'Provider adapters are deliberately disabled during Phase 0.';
}

export function getIntegrationFoundationStatus(): IntegrationFoundationStatus {
  return {
    status: 'not_initialized',
    detail: 'Provider adapters are deliberately disabled during Phase 0.',
  };
}
