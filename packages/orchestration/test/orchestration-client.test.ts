import { describe, expect, it } from 'vitest';

import {
  ConvexHttpOrchestrationPublisher,
  OrchestrationUnavailableError,
} from '@jarvis/orchestration';

const deliveryId = '00000000-0000-4000-8000-000000000003';

describe('opaque Vercel-to-Convex orchestration client', () => {
  it('sends only an opaque retry signal and never serializes a private delivery body', async () => {
    const calls: Array<{ readonly url: string; readonly body: unknown }> = [];
    const publisher = new ConvexHttpOrchestrationPublisher({
      baseUrl: 'https://convex.example.invalid',
      secret: 'vercel-to-convex-test-secret',
      fetch: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return new Response('{}', { status: 202 });
      },
    });

    await publisher.scheduleTransportSignal({
      deliveryId,
      scheduledAt: '2026-08-31T12:00:05.000Z',
    });

    expect(calls).toEqual([
      {
        url: 'https://convex.example.invalid/internal/transport-signal/schedule',
        body: { deliveryId, scheduledAt: Date.parse('2026-08-31T12:00:05.000Z') },
      },
    ]);
    expect(JSON.stringify(calls)).not.toContain('Canonical Neon delivery content');
  });

  it('maps a Convex outage to an explicit safe orchestration error', async () => {
    const publisher = new ConvexHttpOrchestrationPublisher({
      baseUrl: 'https://convex.example.invalid',
      secret: 'vercel-to-convex-test-secret',
      fetch: async () => {
        throw new Error('connection refused');
      },
    });

    await expect(
      publisher.publishTransportSignal({ deliveryId, createdAt: '2026-08-31T12:00:00.000Z' }),
    ).rejects.toBeInstanceOf(OrchestrationUnavailableError);
  });
});
