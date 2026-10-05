import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { registerTelegramBotOperatorRoutes } from '../src/telegram-bot-operator-routes.js';

const token = 'telegram-operator-test-token-0123456789';

describe('Telegram operator boundary', () => {
  let app: ReturnType<typeof Fastify> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('returns only an operator-authenticated one-way database access marker', async () => {
    app = Fastify({ logger: false });
    registerTelegramBotOperatorRoutes(app, {
      operatorToken: token,
      ownerId: '00000000-0000-4000-8000-000000000001',
      webhookUrl: 'https://jarvis.example.test/api/webhooks/telegram',
      webhookSecret: 'telegram-webhook-secret-0123456789',
      client: {
        webhookInfo: async () => ({
          configured: true,
          pendingUpdateCount: 0,
          lastErrorCategory: null,
        }),
      } as never,
      events: {} as never,
      enrollment: {} as never,
      connectionId: '00000000-0000-4000-8000-000000000002',
      databaseRoleFingerprint: async () => 'opaque-role-fingerprint',
    });
    const unauthenticated = await app.inject({
      method: 'GET',
      url: '/internal/telegram/operator/webhook/status',
    });
    expect(unauthenticated.statusCode).toBe(401);
    const response = await app.inject({
      method: 'GET',
      url: '/internal/telegram/operator/webhook/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      configured: true,
      pendingUpdateCount: 0,
      lastErrorCategory: null,
      host: 'jarvis.example.test',
      path: '/api/webhooks/telegram',
      databaseRoleFingerprint: 'opaque-role-fingerprint',
    });
  });
});
