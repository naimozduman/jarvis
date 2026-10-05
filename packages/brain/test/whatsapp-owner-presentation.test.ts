import { describe, expect, it } from 'vitest';

import type { BrainRequest } from '@jarvis/contracts';
import { ContextAssembler } from '../src/context/assembler.js';
import { PromptAssembler } from '../src/prompts/assembler.js';

const ownerId = '00000000-0000-4000-8000-000000000001';
const request: BrainRequest = {
  id: '00000000-0000-4000-8000-000000000002',
  ownerId,
  conversationId: '00000000-0000-4000-8000-000000000003',
  sourceEventId: null,
  messageId: null,
  purpose: 'conversation',
  idempotencyKey: 'whatsapp-owner-presentation-eval',
  correlationId: '00000000-0000-4000-8000-000000000004',
  causationId: null,
  requestedAt: '2026-09-30T12:00:00.000Z',
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

describe('WhatsApp owner presentation prompt evaluation', () => {
  it.each(['Hey Jarvis', 'what do I have today?', "bro I'm tired", 'move that thing to later'])(
    'adds the versioned conversational presentation layer for %s',
    (ownerMessage) => {
      const prompt = new PromptAssembler().assemble({
        purpose: 'conversation',
        context: context(),
        ownerMessage,
        presentation: 'whatsapp_owner',
      });
      expect(prompt.moduleIds).toContain('whatsapp-owner-presentation@1.0.0');
      expect(prompt.instructions).toContain('natural text conversation');
      expect(prompt.instructions).toContain('Do not repeat the owner’s question');
      expect(prompt.instructions).toContain('Markdown headings or default bullet lists');
      expect(prompt.instructions).toContain('deterministic server outcomes control');
    },
  );

  it('keeps the presentation layer out of non-WhatsApp prompt provenance', () => {
    const prompt = new PromptAssembler().assemble({
      purpose: 'conversation',
      context: context(),
      ownerMessage: 'Hey Jarvis',
    });
    expect(prompt.moduleIds).not.toContain('whatsapp-owner-presentation@1.0.0');
  });
});
