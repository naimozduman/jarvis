import { v } from 'convex/values';

import { internal } from './_generated/api';
import { env, internalMutation, query } from './_generated/server';

const signalResult = v.object({ sequence: v.number(), duplicate: v.boolean() });

function boundedTimestamp(value: number): number {
  return Math.max(Date.now(), Math.min(value, Date.now() + 1000 * 60 * 60 * 24 * 366));
}

/**
 * Creates an immediately visible opaque signal. It deliberately does not receive an owner,
 * message, prompt, destination, or provider payload from Vercel.
 */
export const publishTransportSignal = internalMutation({
  args: { deliveryId: v.string(), createdAt: v.number() },
  returns: signalResult,
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query('transportSignals')
      .withIndex('by_deliveryId_and_state', (query) =>
        query.eq('deliveryId', args.deliveryId).eq('state', 'pending'),
      )
      .unique();
    if (pending) return { sequence: pending.sequence, duplicate: true };
    const scheduled = await ctx.db
      .query('transportSignals')
      .withIndex('by_deliveryId_and_state', (query) =>
        query.eq('deliveryId', args.deliveryId).eq('state', 'scheduled'),
      )
      .unique();
    if (scheduled) {
      if (scheduled.schedulerId) await ctx.scheduler.cancel(scheduled.schedulerId);
      await ctx.db.patch(scheduled._id, {
        state: 'pending',
        createdAt: args.createdAt,
        scheduledAt: undefined,
        schedulerId: undefined,
      });
      return { sequence: scheduled.sequence, duplicate: true };
    }
    const latest = await ctx.db
      .query('transportSignals')
      .withIndex('by_deliveryId', (query) => query.eq('deliveryId', args.deliveryId))
      .order('desc')
      .first();
    const sequence = (latest?.sequence ?? 0) + 1;
    await ctx.db.insert('transportSignals', {
      deliveryId: args.deliveryId,
      sequence,
      state: 'pending',
      createdAt: args.createdAt,
    });
    return { sequence, duplicate: false };
  },
});

/** Schedules a retry signal without putting a message body or retry payload in Convex. */
export const scheduleTransportSignal = internalMutation({
  args: { deliveryId: v.string(), scheduledAt: v.number() },
  returns: signalResult,
  handler: async (ctx, args) => {
    const scheduledAt = boundedTimestamp(args.scheduledAt);
    const pending = await ctx.db
      .query('transportSignals')
      .withIndex('by_deliveryId_and_state', (query) =>
        query.eq('deliveryId', args.deliveryId).eq('state', 'pending'),
      )
      .unique();
    const scheduled =
      pending ??
      (await ctx.db
        .query('transportSignals')
        .withIndex('by_deliveryId_and_state', (query) =>
          query.eq('deliveryId', args.deliveryId).eq('state', 'scheduled'),
        )
        .unique());
    if (scheduled?.schedulerId) await ctx.scheduler.cancel(scheduled.schedulerId);
    const latest = scheduled
      ? undefined
      : await ctx.db
          .query('transportSignals')
          .withIndex('by_deliveryId', (query) => query.eq('deliveryId', args.deliveryId))
          .order('desc')
          .first();
    const sequence = scheduled?.sequence ?? (latest?.sequence ?? 0) + 1;
    const schedulerId = await ctx.scheduler.runAt(
      scheduledAt,
      internal.transportSignals.activateTransportSignal,
      { deliveryId: args.deliveryId, sequence },
    );
    if (scheduled) {
      await ctx.db.patch(scheduled._id, {
        state: 'scheduled',
        scheduledAt,
        schedulerId,
        acknowledgedAt: undefined,
      });
    } else {
      await ctx.db.insert('transportSignals', {
        deliveryId: args.deliveryId,
        sequence,
        state: 'scheduled',
        createdAt: Date.now(),
        scheduledAt,
        schedulerId,
      });
    }
    return { sequence, duplicate: Boolean(scheduled) };
  },
});

export const activateTransportSignal = internalMutation({
  args: { deliveryId: v.string(), sequence: v.number() },
  returns: v.object({ activated: v.boolean() }),
  handler: async (ctx, args) => {
    const signal = await ctx.db
      .query('transportSignals')
      .withIndex('by_deliveryId_and_state', (query) =>
        query.eq('deliveryId', args.deliveryId).eq('state', 'scheduled'),
      )
      .unique();
    if (!signal || signal.sequence !== args.sequence) return { activated: false };
    await ctx.db.patch(signal._id, {
      state: 'pending',
      scheduledAt: undefined,
      schedulerId: undefined,
    });
    return { activated: true };
  },
});

export const acknowledgeTransportSignal = internalMutation({
  args: { deliveryId: v.string(), sequence: v.number(), acknowledgedAt: v.number() },
  returns: v.object({ acknowledged: v.boolean() }),
  handler: async (ctx, args) => {
    const signal = await ctx.db
      .query('transportSignals')
      .withIndex('by_deliveryId_and_state', (query) =>
        query.eq('deliveryId', args.deliveryId).eq('state', 'pending'),
      )
      .unique();
    if (!signal || signal.sequence !== args.sequence) return { acknowledged: false };
    await ctx.db.patch(signal._id, { state: 'acknowledged', acknowledgedAt: args.acknowledgedAt });
    return { acknowledged: true };
  },
});

/**
 * The bridge subscribes to a content-free projection. The query maps fields rather than returning
 * a document, so a later schema addition cannot accidentally reveal private data to the bridge.
 */
export const listPendingForBridge = query({
  args: { bridgeToken: v.string(), limit: v.number() },
  returns: v.array(
    v.object({
      deliveryId: v.string(),
      sequence: v.number(),
      createdAt: v.number(),
      state: v.literal('pending'),
    }),
  ),
  handler: async (ctx, args) => {
    if (!env.JARVIS_LOCAL_BRIDGE_TOKEN || args.bridgeToken !== env.JARVIS_LOCAL_BRIDGE_TOKEN) {
      return [];
    }
    const limit = Math.max(1, Math.min(args.limit, 100));
    const signals = await ctx.db
      .query('transportSignals')
      .withIndex('by_state_and_createdAt', (query) => query.eq('state', 'pending'))
      .take(limit);
    return signals.map((signal) => ({
      deliveryId: signal.deliveryId,
      sequence: signal.sequence,
      createdAt: signal.createdAt,
      state: 'pending' as const,
    }));
  },
});
