import { describe, expect, it } from 'vitest';

import type { BrainRequest } from '@jarvis/contracts';
import { ContextAssembler } from '../src/context/assembler.js';
import { PromptAssembler } from '../src/prompts/assembler.js';

const request: BrainRequest = {
  id: '10000000-0000-4000-8000-000000000002',
  ownerId: '10000000-0000-4000-8000-000000000001',
  conversationId: '10000000-0000-4000-8000-000000000003',
  sourceEventId: null,
  messageId: null,
  purpose: 'conversation',
  idempotencyKey: 'telegram-owner-presentation-eval',
  correlationId: '10000000-0000-4000-8000-000000000004',
  causationId: null,
  requestedAt: '2026-10-01T12:00:00.000Z',
  state: 'received',
};

function context() {
  return new ContextAssembler({
    maxContextRecords: 4,
    maxRecentMessages: 4,
    maxApproxPromptTokens: 6_000,
  }).assemble({
    request,
    now: request.requestedAt,
    records: [],
    hardOverrideIds: [],
    availableData: [],
  });
}

describe('Telegram owner presentation prompt evaluation', () => {
  it.each(['Hey Jarvis', "what's up", "bro I'm tired", 'ne var bugün?', 'abi ben yorgunum'])(
    'adds the wording-only Telegram owner layer for %s',
    (ownerMessage) => {
      const prompt = new PromptAssembler().assemble({
        purpose: 'conversation',
        context: context(),
        ownerMessage,
        presentation: 'telegram_owner',
      });
      expect(prompt.moduleIds).toContain('telegram-owner-presentation@1.0.0');
      expect(prompt.instructions).toContain('wording-only layer');
      expect(prompt.instructions).toContain('Turkish-English code-switching');
      expect(prompt.instructions).toContain('Deterministic server outcomes control');
      expect(prompt.instructions).not.toContain('whatsapp-owner-presentation');
    },
  );

  it('does not select Telegram presentation from ordinary turns', () => {
    const prompt = new PromptAssembler().assemble({
      purpose: 'conversation',
      context: context(),
      ownerMessage: 'Hey Jarvis',
    });
    expect(prompt.moduleIds).not.toContain('telegram-owner-presentation@1.0.0');
  });
});
