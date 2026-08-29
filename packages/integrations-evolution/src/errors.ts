export type EvolutionErrorCategory =
  | 'authentication_failed'
  | 'license_required'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'malformed_response'
  | 'provider_error_response'
  | 'validation'
  | 'connection_closed'
  | 'incompatible_dependency'
  | 'not_configured'
  | 'unsupported'
  | 'unknown';

export class EvolutionTransportError extends Error {
  public constructor(
    message: string,
    public readonly category: EvolutionErrorCategory,
    public readonly retryable: boolean,
    public readonly requiresReconciliation = false,
  ) {
    super(message);
    this.name = 'EvolutionTransportError';
  }
}

export function classifyEvolutionHttpFailure(input: {
  readonly status: number;
  readonly code: string | undefined;
}): EvolutionTransportError {
  if (input.status === 503 && input.code === 'LICENSE_REQUIRED') {
    return new EvolutionTransportError(
      'Evolution licensing requires an operator action.',
      'license_required',
      false,
    );
  }
  if (input.status === 401 || input.status === 403) {
    return new EvolutionTransportError(
      'Evolution rejected the configured credentials.',
      'authentication_failed',
      false,
    );
  }
  if (input.status === 429) {
    return new EvolutionTransportError('Evolution rate limited the request.', 'rate_limited', true);
  }
  if (input.status >= 500) {
    return new EvolutionTransportError(
      'Evolution returned a transient server failure.',
      'network',
      true,
    );
  }
  return new EvolutionTransportError('Evolution rejected a provider request.', 'validation', false);
}

export function classifyEvolutionError(error: unknown): EvolutionTransportError {
  if (error instanceof EvolutionTransportError) {
    return error;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (/(abort|timeout|timed out)/.test(message)) {
    return new EvolutionTransportError(
      'The Evolution request timed out after dispatch and requires reconciliation before retry.',
      'timeout',
      true,
      true,
    );
  }
  if (/(network|fetch|connection|econn|socket)/.test(message)) {
    return new EvolutionTransportError('Evolution could not be reached.', 'network', true);
  }
  return new EvolutionTransportError('Evolution failed unexpectedly.', 'unknown', false);
}
