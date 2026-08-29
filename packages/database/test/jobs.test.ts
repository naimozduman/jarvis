import { describe, expect, it } from 'vitest';

import {
  calculateRetryDelaySeconds,
  classifyJobError,
  resolveJobFailureState,
} from '@jarvis/database';

describe('durable-job retry behavior', () => {
  it('classifies only transient failure categories as retryable and sanitizes summaries', () => {
    expect(classifyJobError(new Error('connection reset by peer'))).toEqual({
      category: 'transient_network',
      disposition: 'retryable',
      summary: 'A transient network dependency failed.',
    });
    expect(classifyJobError(new Error('validation: missing field'))).toEqual({
      category: 'validation',
      disposition: 'terminal',
      summary: 'Job input validation failed.',
    });
    const waitingForTransport = new Error('Transport is disconnected.');
    waitingForTransport.name = 'TransportRetryableJobError';
    expect(classifyJobError(waitingForTransport)).toEqual({
      category: 'transient_network',
      disposition: 'retryable',
      summary: 'A transport delivery is waiting for a retryable transport condition.',
    });
  });

  it('uses bounded exponential retry delays rather than an infinite retry loop', () => {
    expect(calculateRetryDelaySeconds(1)).toBe(2);
    expect(calculateRetryDelaySeconds(2)).toBe(4);
    expect(calculateRetryDelaySeconds(20)).toBe(3_600);
  });

  it('projects retryable failures and terminal failures without exceeding the attempt bound', () => {
    const transient = classifyJobError(new Error('connection reset by peer'));
    const invalid = classifyJobError(new Error('validation: missing field'));

    expect(resolveJobFailureState(2, 5, transient)).toEqual({
      status: 'retry_wait',
      retryDelaySeconds: 4,
    });
    expect(resolveJobFailureState(5, 5, transient)).toEqual({
      status: 'terminal_failed',
      retryDelaySeconds: undefined,
    });
    expect(resolveJobFailureState(1, 5, invalid)).toEqual({
      status: 'terminal_failed',
      retryDelaySeconds: undefined,
    });
  });
});
