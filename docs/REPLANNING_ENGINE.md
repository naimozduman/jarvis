# Replanning engine

The live-day model represents fixed blocks, hard external anchors, flexible/preferred/optional blocks, commitment-linked work, travel and preparation buffers, sleep/training windows, priority, duration, earliest/latest bounds, dependencies, completion state, source, and placement reason.

The model proposes a plan; `validatePlanConstraints` decides whether it can be applied. Validation rejects foreign owner/day-plan scope, duplicate IDs, missing half-windows, reversed times, window-bound violations, impossible minimum durations, missing dependencies, changed protected anchors, and overlapping scheduled blocks. Omitting a protected existing anchor means preserve it, never delete it.

`ReplanningEngine` evaluates valid options deterministically and states tradeoffs. An active hard override may guide flexible choices but never lets a proposal move an external hard anchor. A validated `internal.plan.update` action is applied only through the Domain policy and action transaction.
