import { describe, expect, it } from 'vitest';

import { channelSchema, incomingEventEnvelopeSchema } from '@jarvis/contracts';

const eventEnvelope = {
  eventType: 'internal.commitment.create.v1',
  source: 'internal',
  idempotencyKey: 'event:1234567890abcdef',
  occurredAt: '2026-08-28T12:00:00.000Z',
  payload: {
    commitmentId: '00000000-0000-4000-8000-000000000101',
    title: 'Finish the schema',
  },
  schemaVersion: 1,
};

describe('canonical event contract', () => {
  it('accepts a versioned provider-neutral event envelope', () => {
    expect(incomingEventEnvelopeSchema.parse(eventEnvelope)).toMatchObject({
      source: 'internal',
      schemaVersion: 1,
    });
  });

  it('rejects an arbitrary owner ID in untrusted ingress', () => {
    expect(() =>
      incomingEventEnvelopeSchema.parse({
        ...eventEnvelope,
        ownerId: '00000000-0000-4000-8000-000000000999',
      }),
    ).toThrow();
  });

  it('rejects an unsupported schema version before persistence', () => {
    expect(() =>
      incomingEventEnvelopeSchema.parse({
        ...eventEnvelope,
        schemaVersion: 0,
      }),
    ).toThrow();
  });

  it('keeps messages to explicit channels while allowing future connector event sources', () => {
    expect(
      incomingEventEnvelopeSchema.parse({
        ...eventEnvelope,
        source: 'gmail',
      }).source,
    ).toBe('gmail');
    expect(() => channelSchema.parse('gmail')).toThrow();
  });
});
