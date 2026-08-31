import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const triggerType = v.union(
  v.literal('canonical_job'),
  v.literal('retry'),
  v.literal('reminder'),
  v.literal('follow_up'),
  v.literal('transport_delivery'),
);

/**
 * Convex is deliberately an execution coordinator, never a replica of the JARVIS brain. Every
 * row below is limited to opaque identifiers, timing, and safe state. There are no message
 * bodies, owners, memories, prompts, provider payloads, or canonical job payloads here.
 */
export default defineSchema({
  scheduledJobs: defineTable({
    jobId: v.string(),
    correlationId: v.string(),
    triggerType,
    generation: v.number(),
    scheduledAt: v.number(),
    state: v.union(
      v.literal('scheduled'),
      v.literal('dispatching'),
      v.literal('dispatched'),
      v.literal('cancelled'),
      v.literal('failed'),
    ),
    dispatchAttempts: v.number(),
    maximumDispatchAttempts: v.number(),
    schedulerId: v.optional(v.id('_scheduled_functions')),
    lastSafeErrorCategory: v.optional(v.string()),
  })
    .index('by_jobId', ['jobId'])
    .index('by_state_and_scheduledAt', ['state', 'scheduledAt']),
  transportSignals: defineTable({
    deliveryId: v.string(),
    sequence: v.number(),
    state: v.union(
      v.literal('scheduled'),
      v.literal('pending'),
      v.literal('acknowledged'),
      v.literal('cancelled'),
    ),
    createdAt: v.number(),
    scheduledAt: v.optional(v.number()),
    schedulerId: v.optional(v.id('_scheduled_functions')),
    acknowledgedAt: v.optional(v.number()),
  })
    .index('by_deliveryId', ['deliveryId'])
    .index('by_deliveryId_and_state', ['deliveryId', 'state'])
    .index('by_state_and_createdAt', ['state', 'createdAt']),
});
