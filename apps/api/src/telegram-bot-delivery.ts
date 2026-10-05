import { TransportRetryableJobError, type TelegramBotDeliveryRepository } from '@jarvis/database';
import type { DurableJob } from '@jarvis/contracts';
import type { TelegramBotClient } from './telegram-bot-client.js';
import { recordTelegramTiming } from './telegram-timing.js';

/** Executes one already-authorized canonical Telegram outbox row under a one-time lease. */
export class TelegramBotDeliveryExecutor {
  public constructor(
    private readonly input: {
      readonly ownerId: string;
      readonly connectionId: string;
      readonly repository: TelegramBotDeliveryRepository;
      readonly deliveryEnabled: boolean;
      readonly client: TelegramBotClient;
    },
  ) {}
  public async execute(job: DurableJob): Promise<void> {
    const deliveryId = job.id;
    const lease = await this.input.repository.acquireOutboundDeliveryLeaseForTelegramBot({
      ownerId: this.input.ownerId,
      deliveryId,
      bridgeId: 'telegram-bot-runtime',
    });
    if (lease.status === 'retry_wait') throw new TransportRetryableJobError(lease.retryAt);
    if (lease.status !== 'ready') return;
    const authority = await this.input.repository.revalidateTelegramFinalSend({
      ownerId: this.input.ownerId,
      connectionId: this.input.connectionId,
      deliveryId,
      bridgeId: 'telegram-bot-runtime',
      leaseToken: lease.leaseToken,
      job,
      deliveryEnabled: this.input.deliveryEnabled,
      intent: lease.intent,
    });
    if (authority.disposition !== 'ready') return;
    // No model, adapter lookup or other asynchronous work between final authority and dispatch.
    const result = await this.input.client.sendText(authority.chatId, authority.content);
    if (result.acceptedAt)
      recordTelegramTiming('final_send_accepted', {
        deliveryId,
        ...(lease.intent.sourceEventId ? { eventId: lease.intent.sourceEventId } : {}),
        ...(lease.intent.brainRequestId ? { requestId: lease.intent.brainRequestId } : {}),
      });
    const outcome = await this.input.repository.recordTelegramBotDeliveryResult({
      ownerId: this.input.ownerId,
      deliveryId,
      bridgeId: 'telegram-bot-runtime',
      leaseToken: lease.leaseToken,
      result,
    });
    if (outcome.disposition === 'retry_scheduled')
      throw new TransportRetryableJobError(outcome.retryAt);
  }
}
