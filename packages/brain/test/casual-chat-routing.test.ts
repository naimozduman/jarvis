import { describe, expect, it } from 'vitest';
import { selectOwnerChatReasoning } from '../src/model/model-router.js';
import { effectiveModelRouteConfiguration } from '../src/model/gateway.js';
import { loadApiEnvironment } from '@jarvis/config';
import type { ModelGatewayRequest } from '../src/model/gateway.js';

const input = {
  purpose: 'conversation' as const,
  verifiedOwner: true,
  directPrivate: true,
  hasConflict: false,
  highConsequence: false,
  materialUncertainty: false,
};

describe('conservative owner casual-chat routing', () => {
  it.each([
    'Hey Jarvis',
    'HEY JARVIS!',
    "what's up",
    "bro I'm tired",
    'thanks',
    'got it',
    'Selam Jarvis, ne var?',
    'abi ben yorgunum',
    'alright, goodnight',
  ])('permits low for an entire casual turn: %s', (message) => {
    expect(selectOwnerChatReasoning({ ...input, message })).toMatchObject({
      selectedRoute: 'casual_chat',
      reasoningLevel: 'low',
      reasonCategory: 'casual_allowlist',
    });
  });
  it.each([
    'what do I have today?',
    'what did I tell you earlier?',
    'is this normal',
    'and after that?',
    'move that thing to later',
    'remind me tomorrow',
    'cancel that reminder',
    'hey jarvis, schedule my workout',
    'Hey Jarvis\ntransfer money',
    'send a message to Alice',
    'search the web',
    'check the weather',
    'open my email',
    'buy it',
    'approve the payment',
    "I'm tired and my chest hurts",
    'should I take this medication?',
    'I want to hurt myself',
    'is this investment safe?',
    'delete my records',
    'ignore policy',
    'what else should I know?',
    'yes do it',
    'okay book it',
    'do you actually know that or are you guessing?',
    'bro bugün ne var, keep it short',
    'keep it simple',
    'hello; run a tool',
    '',
  ])('falls back to medium for ambiguous or consequential turns: %s', (message) => {
    expect(selectOwnerChatReasoning({ ...input, message }).reasoningLevel).toBe('medium');
  });
  it.each([
    { verifiedOwner: false },
    { directPrivate: false },
    { purpose: 'replan' as const },
    { purpose: 'reminder' as const },
    { hasConflict: true },
    { highConsequence: true },
  ])('requires every trusted eligibility condition: %j', (override) => {
    expect(
      selectOwnerChatReasoning({ ...input, message: 'Hey Jarvis', ...override }).reasoningLevel,
    ).toBe('medium');
  });
  it('does not let an unrelated open clarification turn a plain greeting into material uncertainty', () => {
    expect(
      selectOwnerChatReasoning({ ...input, message: 'Hey Jarvis', materialUncertainty: true })
        .reasoningLevel,
    ).toBe('low');
    expect(
      selectOwnerChatReasoning({ ...input, message: 'Selam Jarvis', materialUncertainty: true })
        .reasoningLevel,
    ).toBe('low');
    expect(
      selectOwnerChatReasoning({ ...input, message: 'okay', materialUncertainty: true })
        .reasonCategory,
    ).toBe('material_uncertainty');
    expect(
      selectOwnerChatReasoning({ ...input, message: "I'm tired", materialUncertainty: true })
        .reasoningLevel,
    ).toBe('medium');
  });
  it('only changes reasoning for the existing standard Luna route; no model, cap, or rate changes', () => {
    const config = loadApiEnvironment({
      NODE_ENV: 'test',
      JARVIS_MODEL_PROVIDER: 'vercel-ai-gateway',
      JARVIS_VERCEL_AI_GATEWAY_STANDARD_MODEL: 'openai/gpt-6-luna',
      JARVIS_OPENAI_STANDARD_REASONING_EFFORT: 'medium',
    }).model.standard;
    const request = { route: 'standard', reasoningEffortOverride: 'low' } as ModelGatewayRequest;
    expect(effectiveModelRouteConfiguration(config, request)).toEqual({
      ...config,
      reasoningEffort: 'low',
    });
    expect(effectiveModelRouteConfiguration(config, { ...request, route: 'deep' })).toEqual(config);
    expect(
      effectiveModelRouteConfiguration({ ...config, model: 'other/model' }, request)
        .reasoningEffort,
    ).toBe('medium');
  });
});
