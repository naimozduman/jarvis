import { createHmac, randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { buildApi } from '@jarvis/api';
import { initialJobDispatchGeneration } from '@jarvis/contracts';
import { createDeterministicPhaseOneHandlers } from '@jarvis/domain';
import {
  EvolutionMessageMapper,
  EvolutionOwnerIdentityResolver,
  EvolutionWebhookParser,
  EvolutionWebhookVerifier,
} from '@jarvis/integrations-evolution';
import { evaluatePolicy } from '@jarvis/security';
import { InMemoryEventStore } from '@jarvis/testing';

const ownerId = '00000000-0000-4000-8000-000000000001';
const now = '2026-08-29T12:00:00.000Z';
const instanceName = 'jarvis-test-instance';
const testSigningMaterial = 'phase3-test-signing-material-not-a-deployment-credential';

function signedWebhookToken(): string {
  const timestamp = Math.floor(new Date(now).getTime() / 1_000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ app: 'evolution', action: 'webhook', iat: timestamp, exp: timestamp + 600 }),
  ).toString('base64url');
  const signature = createHmac('sha256', testSigningMaterial)
    .update(`${header}.${payload}`, 'utf8')
    .digest('base64url');
  return `Bearer ${header}.${payload}.${signature}`;
}

function ownerTextPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event: 'MESSAGES_UPSERT',
    instance: instanceName,
    date_time: now,
    data: {
      key: {
        id: 'provider-inbound-001',
        remoteJid: '15551234567@s.whatsapp.net',
        fromMe: false,
      },
      message: { conversation: 'Move my gym to tonight.' },
      messageType: 'conversation',
      messageTimestamp: 1_788_000_000,
    },
    ...overrides,
  };
}

function webhookApp(store: InMemoryEventStore, rejections: Array<Record<string, unknown>>) {
  return buildApi({
    environment: { APP_ENV: 'test' },
    evolutionWebhook: {
      enabled: true,
      ownerId,
      expectedInstanceName: instanceName,
      pipeline: {
        store,
        handlers: createDeterministicPhaseOneHandlers(),
        policy: { evaluate: (action) => evaluatePolicy(action, { ownerAuthorized: true }) },
        createJob(event) {
          return {
            id: randomUUID(),
            ownerId: event.ownerId,
            jobType: 'jarvis.event.process',
            payload: { eventId: event.id },
            priority: 0,
            scheduledFor: event.receivedAt,
            availableAfter: event.receivedAt,
            executionDeadline: null,
            dispatchGeneration: initialJobDispatchGeneration,
            maximumAttempts: 5,
            correlationId: event.correlationId,
            sourceEventId: event.id,
            idempotencyKey: `event-job:${event.id}`,
          };
        },
      },
      verifier: new EvolutionWebhookVerifier({
        secret: testSigningMaterial,
        now: () => new Date(now),
      }),
      parser: new EvolutionWebhookParser(),
      mapper: new EvolutionMessageMapper(new EvolutionOwnerIdentityResolver('15551234567')),
      rejectionRecorder: {
        async record(input) {
          rejections.push({ ...input });
        },
      },
      now: () => new Date(now),
      bodyLimitBytes: 1_024,
    },
  });
}

describe('Evolution webhook ingress', () => {
  it('authenticates, normalizes, persists, queues, and deduplicates a webhook without trusting payload ownership', async () => {
    const store = new InMemoryEventStore();
    const rejections: Array<Record<string, unknown>> = [];
    const app = webhookApp(store, rejections);
    try {
      const payload = ownerTextPayload({ ownerId: '00000000-0000-4000-8000-000000000099' });
      const first = await app.inject({
        method: 'POST',
        url: '/webhooks/evolution',
        headers: { authorization: signedWebhookToken(), 'content-type': 'application/json' },
        payload,
      });
      const replay = await app.inject({
        method: 'POST',
        url: '/webhooks/evolution',
        headers: { authorization: signedWebhookToken(), 'content-type': 'application/json' },
        payload,
      });

      expect(first.statusCode).toBe(202);
      expect(first.json()).toEqual({ accepted: true, duplicate: false, disposition: 'queued' });
      expect(replay.statusCode).toBe(200);
      expect(replay.json()).toEqual({ accepted: true, duplicate: true, disposition: 'duplicate' });
      expect(store.events).toHaveLength(1);
      expect(store.jobs).toHaveLength(1);
      expect(store.events[0]).toMatchObject({ ownerId, source: 'whatsapp' });
      expect(JSON.stringify(store.events[0]?.payload)).not.toContain('15551234567');
      expect(rejections).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it('rejects unknown, group, protocol/history, bad-auth, bad-content, wrong-instance, and oversized traffic before Brain ingress', async () => {
    const store = new InMemoryEventStore();
    const rejections: Array<Record<string, unknown>> = [];
    const app = webhookApp(store, rejections);
    try {
      const request = (payload: Record<string, unknown>, headers: Record<string, string> = {}) =>
        app.inject({
          method: 'POST',
          url: '/webhooks/evolution',
          headers: {
            authorization: signedWebhookToken(),
            'content-type': 'application/json',
            ...headers,
          },
          payload,
        });

      const unknown = await request(
        ownerTextPayload({
          data: {
            key: { id: 'unknown-001', remoteJid: '15550000000@s.whatsapp.net', fromMe: false },
            message: { conversation: 'ignore' },
            messageType: 'conversation',
            messageTimestamp: 1,
          },
        }),
      );
      const group = await request(
        ownerTextPayload({
          data: {
            key: { id: 'group-001', remoteJid: '123@g.us', fromMe: false },
            message: { conversation: 'ignore' },
            messageType: 'conversation',
            messageTimestamp: 1,
          },
        }),
      );
      const protocol = await request(
        ownerTextPayload({
          data: {
            key: { id: 'protocol-001', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
            message: { protocolMessage: { type: 0 } },
            messageType: 'protocolMessage',
            messageTimestamp: 1,
          },
        }),
      );
      const badAuth = await app.inject({
        method: 'POST',
        url: '/webhooks/evolution',
        headers: { authorization: 'Bearer invalid', 'content-type': 'application/json' },
        payload: ownerTextPayload(),
      });
      const badContent = await app.inject({
        method: 'POST',
        url: '/webhooks/evolution',
        headers: { authorization: signedWebhookToken(), 'content-type': 'text/plain' },
        payload: JSON.stringify(ownerTextPayload()),
      });
      const jsonpContent = await app.inject({
        method: 'POST',
        url: '/webhooks/evolution',
        headers: { authorization: signedWebhookToken(), 'content-type': 'application/jsonp' },
        payload: JSON.stringify(ownerTextPayload()),
      });
      const wrongInstance = await request(ownerTextPayload({ instance: 'not-jarvis' }));
      const oversized = await request({ ...ownerTextPayload(), data: 'x'.repeat(2_000) });

      expect([unknown, group, protocol].map((response) => response.statusCode)).toEqual([
        202, 202, 202,
      ]);
      expect(badAuth.statusCode).toBe(401);
      expect(badContent.statusCode).toBe(415);
      expect(jsonpContent.statusCode).toBe(415);
      expect(wrongInstance.statusCode).toBe(403);
      expect(oversized.statusCode).toBe(413);
      expect(store.events).toHaveLength(0);
      expect(store.jobs).toHaveLength(0);
      expect(rejections.map((entry) => entry.reason)).toEqual(
        expect.arrayContaining(['owner_mismatch', 'group_message', 'protocol_or_history']),
      );
      expect(JSON.stringify(rejections)).not.toContain('15550000000');
    } finally {
      await app.close();
    }
  });

  it('returns not_configured by default and never turns a disabled route into a provider call', async () => {
    const app = buildApi({ environment: { APP_ENV: 'test' } });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/evolution',
        headers: { 'content-type': 'application/json' },
        payload: ownerTextPayload(),
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({
        accepted: false,
        duplicate: false,
        disposition: 'not_configured',
      });
      const transportHealth = await app.inject({
        method: 'GET',
        url: '/health/transport/evolution',
      });
      expect(transportHealth.statusCode).toBe(200);
      expect(transportHealth.json()).toMatchObject({
        configured: false,
        connected: false,
        state: 'disabled',
      });
    } finally {
      await app.close();
    }
  });
});
