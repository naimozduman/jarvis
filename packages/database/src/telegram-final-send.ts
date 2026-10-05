import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import type { DurableJob, OutboundDeliveryIntent } from '@jarvis/contracts';
import { createSafeAuditEvent, evaluateOwnerTransportDelivery } from '@jarvis/security';
import type { JarvisDatabase } from './client.js';
import { loadRequestedReminderTarget } from './requested-reminder-target.js';
import {
  auditEvents,
  jobs,
  messages,
  outboundMessageDeliveries,
  proposedActions,
  quietModePeriods,
  reminders,
} from './schema/index.js';

export interface TelegramFinalSendInput {
  readonly ownerId: string;
  readonly connectionId: string;
  readonly deliveryId: string;
  readonly bridgeId: string;
  readonly leaseToken: string;
  /** Snapshot obtained by the canonical executor, never callback/model payload. */
  readonly job: DurableJob;
  readonly deliveryEnabled: boolean;
  readonly intent: OutboundDeliveryIntent;
}

export type TelegramFinalSendOutcome =
  | { readonly disposition: 'ready'; readonly chatId: string; readonly content: string }
  | { readonly disposition: 'blocked'; readonly reasonCategory: string }
  | { readonly disposition: 'unavailable' | 'already_handled' };

/** Last deterministic authority boundary. HTTP runs immediately after this short transaction. */
export async function revalidateTelegramFinalSend(
  database: JarvisDatabase,
  input: TelegramFinalSendInput,
): Promise<TelegramFinalSendOutcome> {
  return database.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, input.job.id), eq(jobs.ownerId, input.ownerId)))
      .limit(1)
      .for('share');
    const [delivery] = await tx
      .select()
      .from(outboundMessageDeliveries)
      .where(
        and(
          eq(outboundMessageDeliveries.id, input.deliveryId),
          eq(outboundMessageDeliveries.ownerId, input.ownerId),
        ),
      )
      .limit(1)
      .for('update');
    if (!delivery || delivery.transport !== 'telegram_bot') return { disposition: 'unavailable' };
    if (delivery.acceptedAt || ['sent', 'delivered', 'read'].includes(delivery.state))
      return { disposition: 'already_handled' };
    // A stale caller must not mutate or consume a newer holder's lease.
    if (
      delivery.state !== 'leased' ||
      delivery.leaseOwner !== input.bridgeId ||
      delivery.leaseToken !== input.leaseToken
    )
      return { disposition: 'unavailable' };
    if (delivery.metadata.telegramFinalSendAttempt === delivery.attemptCount)
      return { disposition: 'already_handled' };
    const clock = await tx.execute(sql`select clock_timestamp() as now`);
    const now = new Date(clock.rows[0]!.now as string | Date);
    const block = async (reasonCategory: string): Promise<TelegramFinalSendOutcome> => {
      await tx
        .update(outboundMessageDeliveries)
        .set({
          state: 'failed_terminal',
          failedAt: now,
          lastErrorCategory: reasonCategory,
          leaseToken: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(outboundMessageDeliveries.id, delivery.id),
            eq(outboundMessageDeliveries.ownerId, input.ownerId),
            eq(outboundMessageDeliveries.leaseToken, input.leaseToken),
          ),
        );
      const audit = createSafeAuditEvent({
        id: randomUUID(),
        ownerId: input.ownerId,
        actorType: 'system',
        actorId: null,
        action: 'transport.telegram.final_send_blocked',
        targetType: 'outbound_delivery',
        targetId: delivery.id,
        occurredAt: now.toISOString(),
        correlationId: delivery.correlationId,
        previousState: { entityType: 'outbound_delivery', entityId: delivery.id },
        resultingState: { entityType: 'outbound_delivery', entityId: delivery.id },
        reason: 'Current canonical state denied Telegram dispatch before the external side effect.',
        source: 'internal',
        metadata: {
          reasonCategory,
          reminderId: delivery.reminderId,
          jobId: input.job.id,
          dispatchGeneration: input.job.dispatchGeneration,
          attemptNumber: input.job.attemptCount,
        },
      });
      await tx.insert(auditEvents).values({ ...audit, occurredAt: now });
      return { disposition: 'blocked', reasonCategory };
    };
    if (delivery.requiresReconciliation) return block('telegram_final_reconciliation_required');
    if (!delivery.leaseExpiresAt || delivery.leaseExpiresAt <= now)
      return block('telegram_final_delivery_lease_stale');
    if (delivery.expiresAt <= now) return block('telegram_final_delivery_expired');
    if (!input.deliveryEnabled || delivery.connectionId !== input.connectionId)
      return block('telegram_final_transport_disabled');
    if (
      !job ||
      job.id !== delivery.id ||
      job.jobType !== 'jarvis.transport.outbound.send' ||
      job.dispatchGeneration !== input.job.dispatchGeneration ||
      job.attemptCount !== input.job.attemptCount ||
      job.status !== 'leased' ||
      !job.leaseOwner ||
      job.leaseOwner !== input.job.leaseOwner ||
      !job.leaseExpiresAt ||
      job.leaseExpiresAt <= now ||
      job.correlationId !== delivery.correlationId
    )
      return block('telegram_final_execution_stale');
    if (
      job.payload.deliveryId !== delivery.id ||
      job.payload.ownerId !== delivery.ownerId ||
      job.payload.connectionId !== delivery.connectionId ||
      job.payload.transport !== delivery.transport ||
      job.payload.operationKey !== delivery.operationKey ||
      job.payload.contentType !== input.intent.contentType ||
      input.intent.id !== delivery.id ||
      input.intent.ownerId !== delivery.ownerId ||
      input.intent.connectionId !== delivery.connectionId ||
      input.intent.targetReference !== delivery.targetReference ||
      input.intent.sourceEventId !== delivery.sourceEventId ||
      input.intent.causationId !== delivery.causationId ||
      input.intent.correlationId !== delivery.correlationId ||
      input.intent.createdAt !== job.scheduledFor.toISOString() ||
      job.sourceEventId !== delivery.sourceEventId ||
      input.intent.operationKey !== delivery.operationKey ||
      input.intent.messageId !== delivery.messageId ||
      input.intent.reminderId !== delivery.reminderId
    )
      return block('telegram_final_binding_changed');
    const [message] = await tx
      .select()
      .from(messages)
      .where(and(eq(messages.id, delivery.messageId), eq(messages.ownerId, input.ownerId)))
      .limit(1)
      .for('share');
    if (
      !message ||
      message.direction !== 'outbound' ||
      message.channel !== 'telegram' ||
      message.conversationId !== input.intent.conversationId ||
      message.content !== input.intent.content ||
      !message.content ||
      !delivery.sourceEventId
    )
      return block('telegram_final_message_binding_changed');
    if (delivery.reminderId) {
      const [reminder] = await tx
        .select()
        .from(reminders)
        .where(and(eq(reminders.id, delivery.reminderId), eq(reminders.ownerId, input.ownerId)))
        .limit(1)
        .for('share');
      if (!reminder || reminder.state !== 'active' || reminder.cancelledAt || reminder.completedAt)
        return block('telegram_final_reminder_inactive');
      if (
        !reminder.jobId ||
        reminder.metadata.fireDeliveryId !== delivery.id ||
        reminder.metadata.requestedDelivery !== true ||
        reminder.metadata.sourceActionId !== delivery.causationId
      )
        return block('telegram_final_reminder_binding_changed');
      const [fire] = await tx
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, reminder.jobId), eq(jobs.ownerId, input.ownerId)))
        .limit(1)
        .for('share');
      const [action] = await tx
        .select()
        .from(proposedActions)
        .where(
          and(
            eq(proposedActions.id, delivery.causationId!),
            eq(proposedActions.ownerId, input.ownerId),
          ),
        )
        .limit(1)
        .for('share');
      if (
        !fire ||
        fire.jobType !== 'jarvis.reminder.fire' ||
        !['leased', 'completed', 'retry_wait'].includes(fire.status) ||
        fire.dispatchGeneration !== reminder.metadata.fireDispatchGeneration ||
        fire.payload.reminderId !== reminder.id ||
        fire.payload.ownerId !== input.ownerId ||
        fire.payload.sourceActionId !== delivery.causationId ||
        fire.sourceEventId !== delivery.sourceEventId ||
        fire.scheduledFor.toISOString() !== input.intent.createdAt ||
        delivery.operationKey !== `reminder:requested:${reminder.id}:${fire.id}` ||
        !action ||
        action.actionType !== 'internal.reminder.create' ||
        action.state !== 'executed' ||
        action.payload.reminderId !== reminder.id ||
        action.sourceEventId !== delivery.sourceEventId
      )
        return block('telegram_final_reminder_superseded');
    }
    const target = await loadRequestedReminderTarget(tx, input.ownerId, delivery.sourceEventId);
    if (
      !target ||
      target.connection.id !== input.connectionId ||
      target.targetReference !== delivery.targetReference ||
      target.conversationId !== message.conversationId
    )
      return block('telegram_final_owner_enrollment_revoked');
    if (!target.connection.outboundEnabled) return block('telegram_final_delivery_disabled');
    if (target.connection.state !== 'connected' || !target.connection.versionVerified)
      return block('telegram_final_transport_unavailable');
    const [quiet] = await tx
      .select({ id: quietModePeriods.id })
      .from(quietModePeriods)
      .where(
        and(
          eq(quietModePeriods.ownerId, input.ownerId),
          eq(quietModePeriods.active, true),
          lte(quietModePeriods.startsAt, now),
          or(isNull(quietModePeriods.endsAt), gt(quietModePeriods.endsAt, now)),
        ),
      )
      .limit(1);
    if (
      !evaluateOwnerTransportDelivery({
        intent: { ...input.intent, critical: delivery.metadata.critical === true },
        configuredOwnerTargetReference: target.targetReference,
        outboundKillSwitchActive: !target.connection.outboundEnabled,
        transportConnected: target.connection.state === 'connected',
        versionVerified: target.connection.versionVerified,
        ownerConversationVerified: true,
        quietModeActive: Boolean(quiet),
      }).allowed
    )
      return block('telegram_final_quiet_mode');
    // Consume this send capability once. A crash/unknown response leaves the existing lease
    // recovery path requiring reconciliation rather than authorizing another provider request.
    await tx
      .update(outboundMessageDeliveries)
      .set({
        metadata: {
          ...delivery.metadata,
          telegramFinalSendAttempt: delivery.attemptCount,
          telegramFinalSendGeneration: job.dispatchGeneration,
          telegramFinalSendCheckedAt: now.toISOString(),
        },
        updatedAt: now,
      })
      .where(eq(outboundMessageDeliveries.id, delivery.id));
    return { disposition: 'ready', chatId: target.providerChatId, content: message.content };
  });
}
