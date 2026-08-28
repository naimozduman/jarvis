export interface DatabaseFoundationStatus {
  readonly status: 'not_initialized';
  readonly detail: 'Database connections and migrations are deferred until Phase 1.';
}

export function getDatabaseFoundationStatus(): DatabaseFoundationStatus {
  return {
    status: 'not_initialized',
    detail: 'Database connections and migrations are deferred until Phase 1.',
  };
}
