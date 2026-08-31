import { defineApp } from 'convex/server';
import { v } from 'convex/values';

/**
 * Only orchestration credentials live in Convex deployment settings. Canonical state and all
 * private content remain in Neon; browser-visible configuration never contains these values.
 */
const app = defineApp({
  env: {
    JARVIS_CONVEX_CALLBACK_URL: v.optional(v.string()),
    JARVIS_CONVEX_TO_VERCEL_SECRET: v.optional(v.string()),
    JARVIS_VERCEL_TO_CONVEX_SECRET: v.optional(v.string()),
    JARVIS_LOCAL_BRIDGE_TOKEN: v.optional(v.string()),
  },
});

export default app;
