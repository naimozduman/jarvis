'use node';

import { v } from 'convex/values';

import { internal } from './_generated/api';
import { env, internalAction } from './_generated/server';

const triggerType = v.union(
  v.literal('canonical_job'),
  v.literal('retry'),
  v.literal('reminder'),
  v.literal('follow_up'),
  v.literal('transport_delivery'),
);

type CallbackResult =
  | { readonly disposition: 'completed' | 'already_completed' | 'stale' | 'cancelled' }
  | { readonly disposition: 'retry_allowed'; readonly retryAt: number }
  | { readonly disposition: 'retry_not_allowed' };

function callbackResult(value: unknown): CallbackResult | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (
    record.disposition === 'completed' ||
    record.disposition === 'already_completed' ||
    record.disposition === 'stale' ||
    record.disposition === 'cancelled' ||
    record.disposition === 'retry_not_allowed'
  ) {
    return { disposition: record.disposition };
  }
  if (record.disposition === 'retry_allowed' && typeof record.retryAt === 'number') {
    return { disposition: 'retry_allowed', retryAt: record.retryAt };
  }
  return undefined;
}

/**
 * The only cloud-to-cloud callback carries opaque IDs. The Vercel handler rehydrates and leases
 * the canonical Neon job; Convex cannot execute or mutate JARVIS life state itself.
 */
export const dispatchScheduledJob = internalAction({
  args: { jobId: v.string(), correlationId: v.string(), triggerType, generation: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claimed: {
      readonly jobId: string;
      readonly correlationId: string;
      readonly triggerType: string;
      readonly generation: number;
    } | null = await ctx.runMutation(internal.scheduler.claimDispatch, args);
    if (!claimed) {
      return null;
    }
    const callbackUrl = env.JARVIS_CONVEX_CALLBACK_URL;
    const secret = env.JARVIS_CONVEX_TO_VERCEL_SECRET;
    if (!callbackUrl || !secret) {
      await ctx.runMutation(internal.scheduler.recordDispatchResult, {
        jobId: args.jobId,
        generation: args.generation,
        disposition: 'callback_unconfirmed',
      });
      return null;
    }
    let result: CallbackResult | undefined;
    try {
      const response = await fetch(
        `${callbackUrl.replace(/\/$/, '')}/internal/orchestration/jobs/${encodeURIComponent(args.jobId)}/run`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${secret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            correlationId: args.correlationId,
            triggerType: args.triggerType,
            generation: args.generation,
          }),
        },
      );
      result = response.ok ? callbackResult(await response.json()) : undefined;
    } catch {
      result = undefined;
    }
    if (!result) {
      // Network uncertainty is not evidence that Neon permits a retry. Leave a safe failed
      // coordinator record for an operator/reconciliation path instead of double-executing work.
      await ctx.runMutation(internal.scheduler.recordDispatchResult, {
        jobId: args.jobId,
        generation: args.generation,
        disposition: 'callback_unconfirmed',
      });
      return null;
    }
    await ctx.runMutation(internal.scheduler.recordDispatchResult, {
      jobId: args.jobId,
      generation: args.generation,
      disposition: result.disposition,
      ...(result.disposition === 'retry_allowed' ? { retryAt: result.retryAt } : {}),
    });
    return null;
  },
});
