import { httpRouter } from 'convex/server';

import { internal } from './_generated/api';
import { env, httpAction } from './_generated/server';
import { isCanonicalDispatchGeneration } from './scheduler_policy.js';
import { hasValidBearerSecret } from './secret_comparison.js';

const http = httpRouter();

async function authorized(request: Request): Promise<boolean> {
  return hasValidBearerSecret(
    env.JARVIS_VERCEL_TO_CONVEX_SECRET,
    request.headers.get('authorization'),
  );
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringField(value: Record<string, unknown>, field: string): string | undefined {
  const candidate = value[field];
  return typeof candidate === 'string' && candidate.trim().length > 0 && candidate.length <= 256
    ? candidate
    : undefined;
}

function numberField(value: Record<string, unknown>, field: string): number | undefined {
  const candidate = value[field];
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

http.route({
  path: '/internal/schedule',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!(await authorized(request))) return json(401, { error: 'unauthorized' });
    const body = record(await request.json().catch(() => undefined));
    if (!body) return json(400, { error: 'invalid_request' });
    const jobId = stringField(body, 'jobId');
    const correlationId = stringField(body, 'correlationId');
    const triggerType = stringField(body, 'triggerType');
    const scheduledAt = numberField(body, 'scheduledAt');
    const generation = numberField(body, 'generation');
    const maximumDispatchAttempts = numberField(body, 'maximumDispatchAttempts');
    if (
      !jobId ||
      !correlationId ||
      !triggerType ||
      !scheduledAt ||
      generation === undefined ||
      !isCanonicalDispatchGeneration(generation) ||
      maximumDispatchAttempts === undefined ||
      !['canonical_job', 'retry', 'reminder', 'follow_up', 'transport_delivery'].includes(
        triggerType,
      )
    ) {
      return json(400, { error: 'invalid_request' });
    }
    try {
      const result = await ctx.runMutation(internal.scheduler.scheduleJob, {
        jobId,
        correlationId,
        triggerType: triggerType as
          'canonical_job' | 'retry' | 'reminder' | 'follow_up' | 'transport_delivery',
        scheduledAt,
        generation,
        maximumDispatchAttempts,
      });
      return json(202, result);
    } catch {
      return json(503, { error: 'orchestration_unavailable' });
    }
  }),
});

http.route({
  path: '/internal/cancel',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!(await authorized(request))) return json(401, { error: 'unauthorized' });
    const body = record(await request.json().catch(() => undefined));
    const jobId = body ? stringField(body, 'jobId') : undefined;
    const generation = body ? numberField(body, 'generation') : undefined;
    if (!jobId || generation === undefined || !isCanonicalDispatchGeneration(generation)) {
      return json(400, { error: 'invalid_request' });
    }
    try {
      return json(
        200,
        await ctx.runMutation(internal.scheduler.cancelScheduledJob, { jobId, generation }),
      );
    } catch {
      return json(503, { error: 'orchestration_unavailable' });
    }
  }),
});

http.route({
  path: '/internal/transport-signal',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!(await authorized(request))) return json(401, { error: 'unauthorized' });
    const body = record(await request.json().catch(() => undefined));
    const deliveryId = body ? stringField(body, 'deliveryId') : undefined;
    const createdAt = body ? numberField(body, 'createdAt') : undefined;
    if (!deliveryId || createdAt === undefined) return json(400, { error: 'invalid_request' });
    try {
      return json(
        202,
        await ctx.runMutation(internal.transportSignals.publishTransportSignal, {
          deliveryId,
          createdAt,
        }),
      );
    } catch {
      return json(503, { error: 'orchestration_unavailable' });
    }
  }),
});

http.route({
  path: '/internal/transport-signal/schedule',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!(await authorized(request))) return json(401, { error: 'unauthorized' });
    const body = record(await request.json().catch(() => undefined));
    const deliveryId = body ? stringField(body, 'deliveryId') : undefined;
    const scheduledAt = body ? numberField(body, 'scheduledAt') : undefined;
    if (!deliveryId || scheduledAt === undefined) return json(400, { error: 'invalid_request' });
    try {
      return json(
        202,
        await ctx.runMutation(internal.transportSignals.scheduleTransportSignal, {
          deliveryId,
          scheduledAt,
        }),
      );
    } catch {
      return json(503, { error: 'orchestration_unavailable' });
    }
  }),
});

http.route({
  path: '/internal/transport-signal/ack',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    if (!(await authorized(request))) return json(401, { error: 'unauthorized' });
    const body = record(await request.json().catch(() => undefined));
    const deliveryId = body ? stringField(body, 'deliveryId') : undefined;
    const sequence = body ? numberField(body, 'sequence') : undefined;
    const acknowledgedAt = body ? numberField(body, 'acknowledgedAt') : undefined;
    if (!deliveryId || sequence === undefined || acknowledgedAt === undefined) {
      return json(400, { error: 'invalid_request' });
    }
    try {
      return json(
        200,
        await ctx.runMutation(internal.transportSignals.acknowledgeTransportSignal, {
          deliveryId,
          sequence,
          acknowledgedAt,
        }),
      );
    } catch {
      return json(503, { error: 'orchestration_unavailable' });
    }
  }),
});

export default http;
