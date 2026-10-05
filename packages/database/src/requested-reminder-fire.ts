import { createHash, randomUUID } from 'node:crypto';

import { and, eq, isNull, lte, gt, or, sql } from 'drizzle-orm';

import type { DurableJob, OutboundDeliveryIntent } from '@jarvis/contracts';
import { evaluateOwnerTransportDelivery } from '@jarvis/security';

import type { JarvisDatabase } from './client.js';
import type { DrizzleDurableDeliveryOutbox } from './transport-repository.js';
import { loadRequestedReminderTarget } from './requested-reminder-target.js';
import { deriveOutboundDeliveryFreshness } from './delivery-lifecycle.js';
import {
  jobs,
  messages,
  outboundMessageDeliveries,
  proposedActions,
  reminderAttempts,
  reminders,
  reminderTriggers,
  auditEvents,
  quietModePeriods,
} from './schema/index.js';

function uuid(seed: string): string {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((Number.parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

/** One explicitly requested reminder, not permission for proactive or recurring messages. */
export class DrizzleRequestedReminderFireRepository {
  public constructor(
    private readonly database: JarvisDatabase,
    private readonly outbox: DrizzleDurableDeliveryOutbox,
    private readonly telegramConnectionId: string | null,
    private readonly telegramEnabled: boolean,
  ) {}

  public async queuedJobsForEvent(ownerId: string, eventId: string): Promise<readonly string[]> {
    return (
      await this.database
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.ownerId, ownerId),
            eq(jobs.sourceEventId, eventId),
            eq(jobs.jobType, 'jarvis.reminder.fire'),
            eq(jobs.status, 'queued'),
          ),
        )
    ).map((row) => row.id);
  }

  public async prepare(
    job: DurableJob,
    providedNow?: Date,
  ): Promise<{ deliveryId: string | null; status: string }> {
    if (
      job.jobType !== 'jarvis.reminder.fire' ||
      job.payload.ownerId !== job.ownerId ||
      typeof job.payload.reminderId !== 'string' ||
      typeof job.payload.sourceActionId !== 'string'
    )
      throw new Error('validation: reminder job lacks canonical scope.');
    return this.database.transaction(async (tx) => {
      const clock = await tx.execute(sql`select clock_timestamp() as now`);
      const now = providedNow ?? new Date(clock.rows[0]!.now as string | Date);
      const [reminder] = await tx
        .select()
        .from(reminders)
        .where(
          and(
            eq(reminders.id, job.payload.reminderId as string),
            eq(reminders.ownerId, job.ownerId),
          ),
        )
        .limit(1)
        .for('update');
      if (
        !reminder ||
        reminder.jobId !== job.id ||
        reminder.metadata.sourceActionId !== job.payload.sourceActionId ||
        reminder.metadata.requestedDelivery !== true
      )
        throw new Error('validation: reminder job binding does not match canonical state.');
      // A retry recovers the already committed intent, never invents a second reminder/message.
      const operationKey = `reminder:requested:${reminder.id}:${job.id}`;
      const [existing] = await tx
        .select({ id: outboundMessageDeliveries.id })
        .from(outboundMessageDeliveries)
        .where(
          and(
            eq(outboundMessageDeliveries.ownerId, job.ownerId),
            eq(outboundMessageDeliveries.operationKey, operationKey),
          ),
        )
        .limit(1);
      if (existing) return { deliveryId: existing.id, status: 'duplicate' };
      if (reminder.state !== 'active' || !reminder.nextEligibleDeliveryAt)
        return { deliveryId: null, status: 'inactive' };
      if (reminder.nextEligibleDeliveryAt.getTime() > now.getTime())
        throw new Error('concurrency: reminder is not due.');
      if (reminder.nextEligibleDeliveryAt.toISOString() !== job.scheduledFor)
        throw new Error('validation: reminder due time changed after scheduling.');
      const [action] = await tx
        .select()
        .from(proposedActions)
        .where(
          and(
            eq(proposedActions.id, job.payload.sourceActionId as string),
            eq(proposedActions.ownerId, job.ownerId),
          ),
        )
        .limit(1);
      if (
        !action ||
        action.state !== 'executed' ||
        action.actionType !== 'internal.reminder.create' ||
        action.payload.reminderId !== reminder.id ||
        !action.sourceEventId ||
        action.sourceEventId !== job.sourceEventId
      )
        throw new Error('validation: reminder lacks executed canonical owner action.');
      const target = await loadRequestedReminderTarget(tx, job.ownerId, action.sourceEventId);
      const connection = target?.connection;
      const [quiet] = await tx
        .select({ id: quietModePeriods.id })
        .from(quietModePeriods)
        .where(
          and(
            eq(quietModePeriods.ownerId, job.ownerId),
            eq(quietModePeriods.active, true),
            lte(quietModePeriods.startsAt, now),
            or(isNull(quietModePeriods.endsAt), gt(quietModePeriods.endsAt, now)),
          ),
        )
        .limit(1);
      const expiresAt = deriveOutboundDeliveryFreshness({
        createdAt: job.scheduledFor,
        reminderId: reminder.id,
        critical: false,
      }).expiresAt;
      const expired = new Date(expiresAt).getTime() <= now.getTime();
      let blocked =
        !this.telegramEnabled ||
        !target ||
        !connection ||
        connection.id !== this.telegramConnectionId ||
        expired;
      const deliveryId = uuid(operationKey);
      const messageId = uuid(`${operationKey}:message`);
      const intent: OutboundDeliveryIntent | null =
        !blocked && target && connection
          ? {
              id: deliveryId,
              ownerId: job.ownerId,
              messageId,
              conversationId: target.conversationId,
              connectionId: connection.id,
              transport: 'telegram_bot',
              targetReference: target.targetReference,
              operationKey,
              contentType: 'text',
              content: `Reminder: ${reminder.title}.`,
              mediaObjectReference: null,
              sourceEventId: action.sourceEventId,
              brainRequestId: null,
              reminderId: reminder.id,
              critical: false,
              correlationId: job.correlationId,
              causationId: action.id,
              createdAt: job.scheduledFor,
            }
          : null;
      if (intent && connection && target) {
        blocked = !evaluateOwnerTransportDelivery({
          intent,
          configuredOwnerTargetReference: target.targetReference,
          outboundKillSwitchActive: !connection.outboundEnabled,
          transportConnected: connection.state === 'connected',
          versionVerified: connection.versionVerified,
          ownerConversationVerified: true,
          quietModeActive: Boolean(quiet),
        }).allowed;
      }
      const outcome = expired
        ? 'expired'
        : blocked || !intent
          ? 'delivery_policy_blocked'
          : 'queued';
      await tx
        .insert(reminderAttempts)
        .values({
          id: uuid(`${operationKey}:attempt`),
          ownerId: job.ownerId,
          reminderId: reminder.id,
          jobId: job.id,
          attemptedAt: now,
          outcome,
          escalationLevel: 0,
          deliveryReference: outcome === 'queued' ? deliveryId : null,
        })
        .onConflictDoNothing();
      if (!blocked && intent) {
        await tx.insert(messages).values({
          id: messageId,
          ownerId: job.ownerId,
          conversationId: intent.conversationId!,
          channel: 'telegram',
          direction: 'outbound',
          content: intent.content,
          contentType: 'text/plain',
          deliveryState: 'pending',
          occurredAt: now,
          receivedAt: now,
          correlationId: job.correlationId,
          sourceEventId: action.sourceEventId,
          metadata: { reminderId: reminder.id, source: 'requested_reminder_fire' },
        });
        await this.outbox.persistAndEnqueueWithinTransaction(tx, intent);
      }
      // A single fire is consumed. Delivery acceptance does not prove the underlying task completed.
      await tx
        .update(reminders)
        .set({
          nextEligibleDeliveryAt: null,
          updatedAt: now,
          metadata: {
            ...reminder.metadata,
            fireOutcome: outcome,
            fireDeliveryId: outcome === 'queued' ? deliveryId : null,
            fireDispatchGeneration: job.dispatchGeneration,
          },
        })
        .where(eq(reminders.id, reminder.id));
      await tx
        .update(reminderTriggers)
        .set({ active: false, nextScheduledAt: null, updatedAt: now })
        .where(
          and(
            eq(reminderTriggers.ownerId, job.ownerId),
            eq(reminderTriggers.reminderId, reminder.id),
          ),
        );
      await tx.insert(auditEvents).values({
        id: randomUUID(),
        ownerId: job.ownerId,
        actorType: 'system',
        action: 'reminder.requested.fire',
        targetType: 'reminder',
        targetId: reminder.id,
        occurredAt: now,
        correlationId: job.correlationId,
        reason: 'An explicit owner reminder was revalidated at due time.',
        source: 'internal',
        metadata: {
          outcome,
          jobId: job.id,
          deliveryId: outcome === 'queued' ? deliveryId : null,
        },
      });
      return { deliveryId: outcome === 'queued' ? deliveryId : null, status: outcome };
    });
  }
}
