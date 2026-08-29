import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  EvolutionClient,
  EvolutionConnectionService,
  EvolutionHealthCheck,
  EvolutionMessageMapper,
  EvolutionMessagingTransport,
  EvolutionOwnerIdentityResolver,
  EvolutionWebhookParser,
  EvolutionWebhookVerifier,
  classifyEvolutionHttpFailure,
  isPatchedBaileysVersion,
  ownerTargetReference,
  reviewedEvolutionSourceBuildId,
  verifyEvolutionVersionGate,
  type EvolutionFetch,
  type EvolutionVersionEvidence,
} from '@jarvis/integrations-evolution';

const ownerId = '00000000-0000-4000-8000-000000000001';
const connectionId = '00000000-0000-4000-8000-000000000002';
const correlationId = '00000000-0000-4000-8000-000000000003';
const now = '2026-08-29T12:00:00.000Z';
const instanceName = 'jarvis-test-instance';
const testSigningMaterial = 'phase3-test-signing-material-not-a-deployment-credential';
const imageDigest = `sha256:${'a'.repeat(64)}`;

const evidence: EvolutionVersionEvidence = {
  providerBuildId: reviewedEvolutionSourceBuildId,
  baileysVersion: '7.0.0-rc13',
  imageDigest,
  unstableSourceBuildAllowed: true,
  appEnvironment: 'test',
};

function signedWebhookToken(
  signingMaterial = testSigningMaterial,
  claims: Record<string, unknown> = {},
): string {
  const timestamp = Math.floor(new Date(now).getTime() / 1_000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      app: 'evolution',
      action: 'webhook',
      iat: timestamp,
      exp: timestamp + 600,
      ...claims,
    }),
  ).toString('base64url');
  const signature = createHmac('sha256', signingMaterial)
    .update(`${header}.${payload}`, 'utf8')
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function upsertFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event: 'MESSAGES_UPSERT',
    instance: instanceName,
    date_time: now,
    data: {
      key: {
        id: 'provider-message-001',
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

/** Deterministic in-process HTTP fake: no socket, credential, or WhatsApp account is involved. */
class FakeEvolutionHttpServer {
  public readonly calls: Array<{ readonly url: string; readonly init: RequestInit | undefined }> =
    [];
  private readonly responses: Response[] = [];

  public enqueue(response: Response): void {
    this.responses.push(response);
  }

  public readonly fetch: EvolutionFetch = async (url, init) => {
    this.calls.push({ url: url.toString(), init });
    const next = this.responses.shift();
    if (!next) {
      throw new Error('Fake Evolution received an unplanned request.');
    }
    return next;
  };
}

function textRequest() {
  return {
    deliveryId: '00000000-0000-4000-8000-000000000011',
    ownerId,
    connectionId,
    targetReference: ownerTargetReference('15551234567'),
    operationKey:
      'transport:owner-response:00000000-0000-4000-8000-000000000002:00000000-0000-4000-8000-000000000011',
    text: 'I moved your gym block to tonight.',
    correlationId,
    causationId: null,
  } as const;
}

describe('Phase 3 transport evaluations', () => {
  it('01: blocks vulnerable Baileys and accepts only the reviewed, pinned non-production contingency', () => {
    expect(isPatchedBaileysVersion('7.0.0-rc11')).toBe(false);
    expect(isPatchedBaileysVersion('7.0.0-rc12')).toBe(true);
    expect(isPatchedBaileysVersion('7.0.0-rc13')).toBe(true);
    expect(verifyEvolutionVersionGate(evidence)).toMatchObject({
      verified: true,
      reason: 'verified',
    });
    expect(verifyEvolutionVersionGate({ ...evidence, baileysVersion: '7.0.0-rc9' })).toMatchObject({
      verified: false,
      reason: 'vulnerable_baileys',
    });
    expect(verifyEvolutionVersionGate({ ...evidence, appEnvironment: 'production' })).toMatchObject(
      { verified: false, reason: 'unstable_build_prohibited_in_production' },
    );
    expect(verifyEvolutionVersionGate({ ...evidence, imageDigest: 'not-a-digest' })).toMatchObject({
      verified: false,
      reason: 'invalid_image_digest',
    });
  });

  it('02: verifies Evolution JWT callbacks and derives nothing from a payload owner field', () => {
    const verifier = new EvolutionWebhookVerifier({
      secret: testSigningMaterial,
      now: () => new Date(now),
    });
    expect(verifier.verify(`Bearer ${signedWebhookToken()}`)).toEqual({ verified: true });
    expect(verifier.verify(`Bearer ${signedWebhookToken('wrong-test-material')}`)).toMatchObject({
      verified: false,
      reason: 'invalid_signature',
    });
    expect(verifier.verify('Bearer unsigned.payload.value')).toMatchObject({ verified: false });

    const parsed = new EvolutionWebhookParser().parse(
      upsertFixture({ ownerId: '00000000-0000-4000-8000-000000000099' }),
    );
    expect(parsed).not.toHaveProperty('ownerId');
    expect(parsed.unknownTopLevelFields).toContain('ownerId');
  });

  it('03: resolves direct, LID, and alternate owner identities while rejecting every untrusted conversation class', () => {
    const resolver = new EvolutionOwnerIdentityResolver('+1 (555) 123-4567', {
      trustedOwnerLids: ['123456789@lid'],
    });
    expect(resolver.resolve({ remoteJid: '15551234567@s.whatsapp.net' })).toMatchObject({
      accepted: true,
      sender: { kind: 'phone' },
    });
    expect(
      resolver.resolve({
        remoteJid: '123456789@lid',
      }),
    ).toMatchObject({ accepted: true, sender: { kind: 'lid' } });
    expect(
      resolver.resolve({
        remoteJid: '15551234567@c.us',
      }),
    ).toMatchObject({ accepted: true, sender: { kind: 'alternate' } });
    expect(
      resolver.resolve({
        remoteJid: 'untrusted-lid@lid',
        remoteJidAlt: '15551234567@s.whatsapp.net',
      }),
    ).toMatchObject({ accepted: false, reason: 'unresolved_lid' });
    expect(
      resolver.resolve({
        remoteJid: '15550000000@c.us',
        participantAlt: '15551234567@s.whatsapp.net',
      }),
    ).toMatchObject({ accepted: false, reason: 'owner_mismatch' });
    expect(resolver.resolve({ remoteJid: '15550000000@s.whatsapp.net' })).toMatchObject({
      accepted: false,
      reason: 'owner_mismatch',
    });
    expect(resolver.resolve({ remoteJid: 'not-a-jid' })).toMatchObject({
      accepted: false,
      reason: 'malformed_sender',
    });
    expect(resolver.resolve({ remoteJid: '123@g.us' })).toMatchObject({
      accepted: false,
      reason: 'group_message',
    });
    expect(resolver.resolve({ remoteJid: 'status@broadcast' })).toMatchObject({
      accepted: false,
      reason: 'status_message',
    });
    expect(resolver.resolve({ remoteJid: '120363000000000000@newsletter' })).toMatchObject({
      accepted: false,
      reason: 'broadcast_or_newsletter',
    });
  });

  it('04: normalizes text, quoted text, voice metadata, images, documents, locations, contacts, and reactions without raw JIDs', () => {
    const mapper = new EvolutionMessageMapper(new EvolutionOwnerIdentityResolver('15551234567'));
    const parser = new EvolutionWebhookParser();
    const cases: Array<{
      readonly name: string;
      readonly message: Record<string, unknown>;
      readonly expected: string;
    }> = [
      {
        name: 'text with quote',
        message: {
          extendedTextMessage: {
            text: 'Move it to tonight.',
            contextInfo: { stanzaId: 'quoted-001', remoteJid: '15551234567@s.whatsapp.net' },
          },
        },
        expected: 'text',
      },
      {
        name: 'voice metadata',
        message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus', fileLength: 1234 } },
        expected: 'audio',
      },
      {
        name: 'image metadata',
        message: { imageMessage: { mimetype: 'image/jpeg', fileLength: 99, caption: 'gym photo' } },
        expected: 'image',
      },
      {
        name: 'document metadata',
        message: {
          documentMessage: { mimetype: 'application/pdf', fileName: 'plan.pdf', fileLength: 321 },
        },
        expected: 'document',
      },
      {
        name: 'location',
        message: { locationMessage: { degreesLatitude: 1 } },
        expected: 'location',
      },
      { name: 'contact', message: { contactMessage: { displayName: 'Gym' } }, expected: 'contact' },
      { name: 'reaction', message: { reactionMessage: { text: '👍' } }, expected: 'reaction' },
    ];

    for (const fixture of cases) {
      const parsed = parser.parse(
        upsertFixture({
          data: {
            key: {
              id: `provider-${fixture.name.replaceAll(' ', '-')}`,
              remoteJid: '15551234567@s.whatsapp.net',
              fromMe: false,
            },
            message: fixture.message,
            messageType: fixture.name,
            messageTimestamp: 1_788_000_000,
          },
        }),
      );
      const mapped = mapper.map(parsed);
      expect(mapped).toMatchObject({ accepted: true, event: { kind: 'message.received' } });
      if (!mapped.accepted) throw new Error('Expected an accepted normalized fixture.');
      expect(mapped.event.message?.messageType).toBe(fixture.expected);
      expect(JSON.stringify(mapped.event)).not.toContain('15551234567');
    }
  });

  it('05: rejects malicious protocol/history/resend and outbound echo fixtures before canonical ingress', () => {
    const mapper = new EvolutionMessageMapper(new EvolutionOwnerIdentityResolver('15551234567'));
    const parser = new EvolutionWebhookParser();
    const malicious = [
      upsertFixture({
        data: {
          key: { id: 'protocol-001', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
          message: { protocolMessage: { type: 0 } },
          messageType: 'protocolMessage',
          messageTimestamp: 1,
        },
      }),
      upsertFixture({
        data: {
          key: { id: 'history-001', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
          message: { historySyncNotification: { syncType: 1 } },
          messageType: 'history_sync',
          messageTimestamp: 1,
        },
      }),
      upsertFixture({
        data: {
          key: { id: 'placeholder-001', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
          message: { placeholderMessage: { message: {} } },
          messageType: 'placeholder',
          messageTimestamp: 1,
        },
      }),
      upsertFixture({
        data: {
          key: { id: 'echo-001', remoteJid: '15551234567@s.whatsapp.net', fromMe: true },
          message: { conversation: 'Do not re-ingest outbound echo.' },
          messageType: 'conversation',
          messageTimestamp: 1,
        },
      }),
    ];
    expect(malicious.map((fixture) => mapper.map(parser.parse(fixture)))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accepted: false, reason: 'protocol_or_history' }),
        expect.objectContaining({ accepted: false, reason: 'history_sync' }),
        expect.objectContaining({ accepted: false, reason: 'outbound_echo' }),
      ]),
    );
  });

  it('06: uses exact reviewed HTTP routes, bounds the owner recipient, and creates no live dependency', async () => {
    const fake = new FakeEvolutionHttpServer();
    fake.enqueue(
      new Response(JSON.stringify({ key: { id: 'provider-outbound-001' } }), { status: 201 }),
    );
    fake.enqueue(new Response(JSON.stringify({ instance: { state: 'open' } }), { status: 200 }));
    fake.enqueue(new Response(JSON.stringify({ instance: { state: 'open' } }), { status: 200 }));
    const client = new EvolutionClient({
      baseUrl: 'http://evolution.private/',
      apiKey: 'test-only-api-material-not-a-deployment-credential',
      fetch: fake.fetch,
    });
    const transport = new EvolutionMessagingTransport({
      client,
      instanceName,
      ownerPhone: '15551234567',
      connectionId,
      versionEvidence: evidence,
      now: () => new Date(now),
    });
    const sent = await transport.sendText(textRequest());
    const status = await transport.getConnectionStatus({ connectionId });

    expect(sent).toMatchObject({
      disposition: 'accepted',
      providerMessageReference: expect.any(String),
    });
    expect(status).toMatchObject({ state: 'connected', readiness: 'connected' });
    expect(fake.calls[0]?.url).toBe(`http://evolution.private/message/sendText/${instanceName}`);
    expect(fake.calls[0]?.init?.headers).toMatchObject({ apikey: expect.any(String) });
    expect(JSON.stringify(fake.calls[0])).not.toContain('15551234567@s.whatsapp.net');
    expect(
      await new EvolutionHealthCheck(transport, connectionId, true, () => new Date(now)).check(),
    ).toMatchObject({
      configured: true,
      versionVerified: true,
      connected: true,
    });
  });

  it('07: classifies timeout, rate limit, authentication, malformed response, and license failures safely', async () => {
    expect(classifyEvolutionHttpFailure({ status: 429, code: undefined })).toMatchObject({
      category: 'rate_limited',
      retryable: true,
    });
    expect(classifyEvolutionHttpFailure({ status: 401, code: undefined })).toMatchObject({
      category: 'authentication_failed',
      retryable: false,
    });
    expect(classifyEvolutionHttpFailure({ status: 503, code: 'LICENSE_REQUIRED' })).toMatchObject({
      category: 'license_required',
    });

    const malformed = new FakeEvolutionHttpServer();
    malformed.enqueue(new Response('{not-json', { status: 200 }));
    const client = new EvolutionClient({
      baseUrl: 'http://evolution.private/',
      apiKey: 'test-only-api-material-not-a-deployment-credential',
      fetch: malformed.fetch,
    });
    await expect(
      client.sendText({ instanceName, number: '15551234567', text: 'hello', messageId: 'test-id' }),
    ).rejects.toMatchObject({ category: 'malformed_response' });

    const timeoutClient = new EvolutionClient({
      baseUrl: 'http://evolution.private/',
      apiKey: 'test-only-api-material-not-a-deployment-credential',
      fetch: async () => {
        throw new Error('request timed out');
      },
    });
    const transport = new EvolutionMessagingTransport({
      client: timeoutClient,
      instanceName,
      ownerPhone: '15551234567',
      connectionId,
      versionEvidence: evidence,
    });
    await expect(transport.sendText(textRequest())).resolves.toMatchObject({
      disposition: 'retryable_failure',
      errorCategory: 'timeout',
      requiresReconciliation: true,
    });
  });

  it('08: keeps pairing/instance controls behind a gated, ephemeral backend boundary', async () => {
    const fake = new FakeEvolutionHttpServer();
    fake.enqueue(new Response(JSON.stringify({ instance: { status: 'close' } }), { status: 201 }));
    fake.enqueue(
      new Response(
        JSON.stringify({
          instance: { status: 'connecting' },
          qrcode: { base64: 'test-qr-not-real' },
        }),
        { status: 200 },
      ),
    );
    fake.enqueue(
      new Response(JSON.stringify({ status: 'SUCCESS', error: false }), { status: 200 }),
    );
    const service = new EvolutionConnectionService({
      client: new EvolutionClient({
        baseUrl: 'http://evolution.private/',
        apiKey: 'test-only-api-material-not-a-deployment-credential',
        fetch: fake.fetch,
      }),
      instanceName,
      versionEvidence: evidence,
      now: () => new Date(now),
    });
    await service.createInstance();
    const pairing = await service.requestPairing();
    await service.removeSession();
    expect(pairing).toEqual({
      state: 'qr_required',
      qrCode: 'test-qr-not-real',
      expiresAt: '2026-08-29T12:01:00.000Z',
    });
    expect(fake.calls.map((call) => call.url)).toEqual([
      'http://evolution.private/instance/create',
      `http://evolution.private/instance/connect/${instanceName}`,
      `http://evolution.private/instance/delete/${instanceName}`,
    ]);
  });

  it('09: normalizes connection loss, degraded state, and reconnection as auditable transport state, never as user text', () => {
    const mapper = new EvolutionMessageMapper(new EvolutionOwnerIdentityResolver('15551234567'));
    const parser = new EvolutionWebhookParser();
    const disconnected = mapper.map(
      parser.parse({
        event: 'CONNECTION_UPDATE',
        instance: instanceName,
        date_time: now,
        data: { state: 'close' },
      }),
    );
    const reconnected = mapper.map(
      parser.parse({
        event: 'CONNECTION_UPDATE',
        instance: instanceName,
        date_time: '2026-08-29T12:01:00.000Z',
        data: { state: 'open' },
      }),
    );
    const degraded = mapper.map(
      parser.parse({
        event: 'CONNECTION_UPDATE',
        instance: instanceName,
        date_time: '2026-08-29T12:00:30.000Z',
        data: { state: 'degraded' },
      }),
    );
    const reconnecting = mapper.map(
      parser.parse({
        event: 'CONNECTION_UPDATE',
        instance: instanceName,
        date_time: '2026-08-29T12:00:45.000Z',
        data: { state: 'reconnecting' },
      }),
    );
    expect(disconnected).toMatchObject({
      accepted: true,
      event: { kind: 'connection.updated', connection: { state: 'disconnected' }, message: null },
    });
    expect(reconnected).toMatchObject({
      accepted: true,
      event: { kind: 'connection.updated', connection: { state: 'connected' }, message: null },
    });
    expect(degraded).toMatchObject({
      accepted: true,
      event: { kind: 'connection.updated', connection: { state: 'degraded' }, message: null },
    });
    expect(reconnecting).toMatchObject({
      accepted: true,
      event: { kind: 'connection.updated', connection: { state: 'reconnecting' }, message: null },
    });
  });
});
