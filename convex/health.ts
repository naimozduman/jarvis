import { query } from './_generated/server';
import { v } from 'convex/values';

/** Public, content-free liveness response for the local bridge and deployment checks. */
export const get = query({
  args: {},
  returns: v.object({ service: v.literal('jarvis-orchestration'), status: v.literal('ok') }),
  handler: async () => ({ service: 'jarvis-orchestration', status: 'ok' as const }),
});
