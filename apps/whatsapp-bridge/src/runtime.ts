import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import type { IncomingEventEnvelope } from '@jarvis/contracts';

import type { BridgeApiPort, InboundNormalizer, LocalWhatsAppBridge } from './bridge.js';

export interface LocalBridgeRuntimeOptions {
  readonly bridge: LocalWhatsAppBridge;
  readonly api: BridgeApiPort;
  readonly inboundNormalizer: InboundNormalizer | undefined;
  readonly host?: string;
  readonly port?: number;
}

/**
 * Binds only to loopback by default. Docker Evolution may target the host through its local Docker
 * network, but no public tunnel, public webhook, or inbound Internet port is introduced.
 */
export function createLocalBridgeRuntime(options: LocalBridgeRuntimeOptions): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 65_536 });
  app.get('/health/live', async () => ({ status: 'ok', scope: 'local_bridge' }));
  app.get('/health/ready', async (_request, reply) => {
    const state = options.bridge.getState();
    return reply.code(state === 'connected' ? 200 : 503).send({
      status: state === 'connected' ? 'ok' : 'degraded',
      bridgeState: state,
    });
  });
  app.post('/webhooks/evolution', async (request, reply) => {
    if (!options.inboundNormalizer) {
      return reply.code(503).send({ error: 'evolution_not_configured' });
    }
    let event: IncomingEventEnvelope | undefined;
    try {
      event = await options.inboundNormalizer.normalize({
        headers: request.headers,
        body: request.body,
      });
    } catch {
      return reply.code(401).send({ error: 'invalid_transport_event' });
    }
    if (!event) return reply.code(400).send({ error: 'invalid_transport_event' });
    try {
      await options.bridge.forwardNormalizedInbound(event);
      return reply.code(202).send({ accepted: true });
    } catch {
      return reply.code(503).send({ error: 'canonical_ingress_unavailable' });
    }
  });
  return app;
}
