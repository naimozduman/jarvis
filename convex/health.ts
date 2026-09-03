import { query } from './_generated/server';
import { v } from 'convex/values';

/** Public, content-free liveness response for the local bridge and deployment checks. */
export const get = query({
  args: {},
  returns: v.object({ service: v.literal('jarvis-orchestration'), status: v.literal('ok') }),
  handler: () => ({ service: 'jarvis-orchestration' as const, status: 'ok' as const }),
});
