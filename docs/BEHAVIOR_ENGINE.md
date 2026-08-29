# Behavior engine

The behavior engine uses a static, reviewable intervention registry rather than asking a model to invent behavioral science. Each definition includes ID, name, version, purpose, trigger conditions, contraindications, required context, example, cooldown, success/failure signals, cost, and domains.

The initial library includes implementation intentions, minimum viable action, environment preparation, friction and choice reduction, precommitment, temptation bundling, time boxing, deadline compression, identity/future-self framing, recovery after a lapse, decomposition, starting rituals, commitment protection, if-then planning, activation-energy reduction, progress visibility, streak protection without obsession, default action design, scheduled decisions, bounded choices, preparation/consequence reminders, and a specific next physical action.

Outcomes are recorded as observed associations. The engine makes no clinical claims and never treats correlation as causation. A model may reference only a registered intervention ID. The `InterventionService` rejects unknown IDs, observes per-owner cooldowns, persists a proposal with its versioned registry definition, and records later outcomes with a context key; it never upgrades association into causal evidence.
