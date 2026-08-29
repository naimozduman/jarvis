import type { BrainResponse } from '@jarvis/contracts';

import type {
  ConversationTurnInput,
  ConversationTurnService,
} from './conversation-turn-service.js';

/** Local/test-only adapter. It persists a local inbound/outbound conversation record but sends nothing. */
export class LocalConversationChannelAdapter {
  public constructor(private readonly service: ConversationTurnService) {}

  public async receive(
    input: Omit<ConversationTurnInput, 'channelMetadata'>,
  ): Promise<BrainResponse> {
    return this.service.process({
      ...input,
      channelMetadata: { adapter: 'local_test_only', externalDelivery: false },
    });
  }
}
