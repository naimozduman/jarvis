import type { BrainRequestPurpose, ModelRoute } from '@jarvis/contracts';

export interface ModelRoutingInput {
  readonly purpose: BrainRequestPurpose;
  readonly hasConflict: boolean;
  readonly highConsequence: boolean;
  readonly deepEscalationEnabled: boolean;
  readonly remainingDeepCalls: number;
}

/**
 * Routing is deterministic. A failed deep decision never silently falls back to a cheaper model:
 * that would change the quality profile of a high-consequence decision without user visibility.
 */
export function selectModelRoute(input: ModelRoutingInput): ModelRoute {
  if (input.purpose === 'classification' || input.purpose === 'memory_extraction') {
    return 'fast';
  }

  if (
    input.deepEscalationEnabled &&
    input.remainingDeepCalls > 0 &&
    (input.purpose === 'weekly_review' || input.hasConflict || input.highConsequence)
  ) {
    return 'deep';
  }

  return 'standard';
}

export interface OwnerChatRoutingInput {
  readonly purpose: BrainRequestPurpose;
  readonly verifiedOwner: boolean;
  readonly directPrivate: boolean;
  readonly message: string;
  readonly hasConflict: boolean;
  readonly highConsequence: boolean;
  readonly materialUncertainty: boolean;
  readonly safetyVerified?: boolean;
}

export interface OwnerChatRoutingDecision {
  readonly selectedRoute: 'casual_chat' | 'standard';
  readonly reasoningLevel: 'low' | 'medium';
  readonly reasonCategory:
    | 'casual_allowlist'
    | 'unverified_surface'
    | 'non_conversation'
    | 'conflict'
    | 'high_consequence'
    | 'material_uncertainty'
    | 'routing_safety_unavailable'
    | 'ambiguous_or_non_casual';
}

// Whole-turn matches only. No substring classifier, model classifier, or permissive default.
// Context questions, referential follow-ups, instructions and mixed intents stay on medium.
const casualTurns = new Set([
  'hey jarvis',
  'hi jarvis',
  'hello jarvis',
  'hey',
  'hi',
  'hello',
  "what's up",
  'whats up',
  'sup',
  "how's it going",
  'how are you',
  "bro i'm tired",
  "i'm tired",
  'im tired',
  'thanks',
  'thank you',
  'thanks jarvis',
  'thanks bro',
  'okay',
  'ok',
  'got it',
  'cool',
  'nice',
  'goodnight',
  'good night',
  'alright goodnight',
  'alright, goodnight',
  'selam jarvis',
  'selam',
  'merhaba',
  'merhaba jarvis',
  'ne var',
  'selam jarvis, ne var',
  'abi ben yorgunum',
  'teşekkürler',
  'iyi geceler',
]);

/** Wording-only chat eligibility. Absence of a recognized safe intent always means medium. */
export function selectOwnerChatReasoning(input: OwnerChatRoutingInput): OwnerChatRoutingDecision {
  const medium = (
    reasonCategory: OwnerChatRoutingDecision['reasonCategory'],
  ): OwnerChatRoutingDecision => ({
    selectedRoute: 'standard',
    reasoningLevel: 'medium',
    reasonCategory,
  });
  if (!input.verifiedOwner || !input.directPrivate) return medium('unverified_surface');
  if (input.purpose !== 'conversation') return medium('non_conversation');
  if (input.safetyVerified === false) return medium('routing_safety_unavailable');
  if (input.hasConflict) return medium('conflict');
  if (input.highConsequence) return medium('high_consequence');
  const normalized = input.message
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’]/gu, "'")
    .trim()
    .replace(/[.!?]+$/u, '')
    .replace(/\s+/gu, ' ');
  // An unrelated open owner clarification does not make an entire plain greeting uncertain.
  const plainGreeting = new Set([
    'hey jarvis',
    'hi jarvis',
    'hello jarvis',
    'hey',
    'hi',
    'hello',
    'selam jarvis',
    'selam',
    'merhaba',
    'merhaba jarvis',
    'selam jarvis, ne var',
  ]).has(normalized);
  if (input.materialUncertainty && !plainGreeting) return medium('material_uncertainty');
  return casualTurns.has(normalized)
    ? { selectedRoute: 'casual_chat', reasoningLevel: 'low', reasonCategory: 'casual_allowlist' }
    : medium('ambiguous_or_non_casual');
}
