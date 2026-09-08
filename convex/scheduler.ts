import { v } from 'convex/values';

import { internal } from './_generated/api';
import { env, internalMutation, internalQuery } from './_generated/server';
import {
  acceptsDispatchClaim,
  acceptsSchedule,
  canScheduleCallbackRetry,
  isCanonicalDispatchGeneration,
  terminalDispatchSettlement,
} from './scheduler_policy.js';

const triggerType = v.union(
  v.literal('canonical_job'),
  v.literal('retry'),
  v.literal('reminder'),
  v.literal('follow_up'),
  v.literal('transport_delivery'),
);

const dispatchDisposition = v.union(
  v.literal('completed'),
  v.literal('already_completed'),
  v.literal('stale'),
  v.literal('cancelled'),
  v.literal('expired'),
  v.literal('retry_allowed'),
  v.literal('retry_not_allowed'),
  v.literal('callback_unconfirmed'),
);

function boundedTimestamp(value: number): number {
  return Math.max(Date.now(), Math.min(value, Date.now() + 1000 * 60 * 60 * 24 * 366));
}

export const scheduleJob = internalMutation({
  args: {
    jobId: v.string(),
    correlationId: v.string(),
    triggerType,
    scheduledAt: v.number(),
    generation: v.number(),
    maximumDispatchAttempts: v.number(),
  },
  returns: v.object({ accepted: v.boolean(), generation: v.number() }),
  handler: async (ctx, args) => {
    if (!isCanonicalDispatchGeneration(args.generation)) {
      throw new Error('validation: canonical dispatch generation is invalid.');
    }
    const existing = await ctx.db
      .query('scheduledJobs')
      .withIndex('by_jobId', (query) => query.eq('jobId', args.jobId))
      .unique()
      .then((value) => value ?? undefined);
    if (!acceptsSchedule(existing, args.generation)) {
      return { accepted: false, generation: existing?.generation ?? args.generation };
    }
    if (existing?.schedulerId) {
      await ctx.scheduler.cancel(existing.schedulerId);
    }
    const scheduledAt = boundedTimestamp(args.scheduledAt);
    const schedulerId = await ctx.scheduler.runAt(scheduledAt, internal.jobs.dispatchScheduledJob, {
      jobId: args.jobId,
      correlationId: args.correlationId,
      triggerType: args.triggerType,
      generation: args.generation,
    });
    const value = {
      jobId: args.jobId,
      correlationId: args.correlationId,
      triggerType: args.triggerType,
      generation: args.generation,
      scheduledAt,
      state: 'scheduled' as const,
      dispatchAttempts: 0,
      maximumDispatchAttempts: Math.max(1, Math.min(args.maximumDispatchAttempts, 20)),
      schedulerId,
    };
    if (existing) {
      await ctx.db.replace(existing._id, value);
    } else {
      await ctx.db.insert('scheduledJobs', value);
    }
    return { accepted: true, generation: args.generation };
  },
});

export const cancelScheduledJob = internalMutation({
  args: { jobId: v.string(), generation: v.number() },
  returns: v.object({ cancelled: v.boolean() }),
  handler: async (ctx, args) => {
    if (!isCanonicalDispatchGeneration(args.generation)) {
      throw new Error('validation: canonical dispatch generation is invalid.');
    }
    const existing = await ctx.db
      .query('scheduledJobs')
      .withIndex('by_jobId', (query) => query.eq('jobId', args.jobId))
      .unique()
      .then((value) => value ?? undefined);
    if (!existing || existing.generation > args.generation) {
      return { cancelled: false };
    }
    if (existing.schedulerId) {
      await ctx.scheduler.cancel(existing.schedulerId);
    }
    await ctx.db.patch(existing._id, {
      generation: args.generation,
      state: 'cancelled',
      schedulerId: undefined,
      lastSafeErrorCategory: undefined,
    });
    return { cancelled: true };
  },
});

export const claimDispatch = internalMutation({
  args: { jobId: v.string(), correlationId: v.string(), triggerType, generation: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      jobId: v.string(),
      correlationId: v.string(),
      triggerType,
      generation: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!isCanonicalDispatchGeneration(args.generation)) {
      return null;
    }
    const existing = await ctx.db
      .query('scheduledJobs')
      .withIndex('by_jobId', (query) => query.eq('jobId', args.jobId))
      .unique()
      .then((value) => value ?? undefined);
    if (!existing || !acceptsDispatchClaim(existing, args)) {
      return null;
    }
    const attempt = existing.dispatchAttempts + 1;
    if (attempt > existing.maximumDispatchAttempts) {
      await ctx.db.patch(existing._id, {
        state: 'failed',
        dispatchAttempts: attempt,
        lastSafeErrorCategory: 'orchestration_attempt_limit',
        schedulerId: undefined,
      });
      return null;
    }
    await ctx.db.patch(existing._id, {
      state: 'dispatching',
      dispatchAttempts: attempt,
      schedulerId: undefined,
      lastSafeErrorCategory: undefined,
    });
    return {
      jobId: existing.jobId,
      correlationId: existing.correlationId,
      triggerType: existing.triggerType,
      generation: existing.generation,
    };
  },
});

export const recordDispatchResult = internalMutation({
  args: {
    jobId: v.string(),
    generation: v.number(),
    disposition: dispatchDisposition,
    retryAt: v.optional(v.number()),
  },
  returns: v.object({ recorded: v.boolean(), retryScheduled: v.boolean() }),
  handler: async (ctx, args) => {
    if (!isCanonicalDispatchGeneration(args.generation)) {
      return { recorded: false, retryScheduled: false };
    }
    const existing = await ctx.db
      .query('scheduledJobs')
      .withIndex('by_jobId', (query) => query.eq('jobId', args.jobId))
      .unique();
    if (!existing || existing.generation !== args.generation || existing.state !== 'dispatching') {
      return { recorded: false, retryScheduled: false };
    }
    if (args.disposition === 'retry_allowed' && args.retryAt !== undefined) {
      if (!canScheduleCallbackRetry(existing)) {
        await ctx.db.patch(existing._id, {
          state: 'failed',
          lastSafeErrorCategory: 'orchestration_attempt_limit',
        });
        return { recorded: true, retryScheduled: false };
      }
      const scheduledAt = boundedTimestamp(args.retryAt);
      const schedulerId = await ctx.scheduler.runAt(
        scheduledAt,
        internal.jobs.dispatchScheduledJob,
        {
          jobId: existing.jobId,
          correlationId: existing.correlationId,
          triggerType: 'retry',
          generation: existing.generation,
        },
      );
      await ctx.db.patch(existing._id, {
        triggerType: 'retry',
        state: 'scheduled',
        scheduledAt,
        schedulerId,
      });
      return { recorded: true, retryScheduled: true };
    }
    const settlement = terminalDispatchSettlement(args.disposition);
    await ctx.db.patch(existing._id, {
      state: settlement.state,
      ...(settlement.lastSafeErrorCategory
        ? { lastSafeErrorCategory: settlement.lastSafeErrorCategory }
        : { lastSafeErrorCategory: undefined }),
    });
    return { recorded: true, retryScheduled: false };
  },
});

/** Used by operational health only; it returns no job payload or private state. */
export const getCoordinatorHealth = internalQuery({
  args: {},
  returns: v.object({ configured: v.boolean() }),
  handler: async () => ({ configured: Boolean(env.JARVIS_CONVEX_CALLBACK_URL) }),
});
