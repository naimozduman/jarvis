import { describe, expect, it, vi } from 'vitest';
import type { DurableJob } from '@jarvis/contracts';
import {
  CanonicalEventJobHandler,
  type CanonicalEventJobHandlerOptions,
} from '../src/event-job-handler.js';

const ownerId = '00000000-0000-4000-8000-000000000001';
const eventId = '00000000-0000-4000-8000-000000000002';
const job = {
  jobType: 'jarvis.reminder.fire',
  id: eventId,
  ownerId,
  payload: { ownerId, eventId },
  correlationId: eventId,
} as DurableJob;
describe('requested reminder postcommit dispatch recovery', () => {
  it('fires canonically and publishes only the committed outbox ID', async () => {
    const fire = vi.fn(async () => ({ deliveryId: eventId }));
    const schedule = vi.fn(async () => undefined);
    const handler = new CanonicalEventJobHandler({
      processRequestedReminder: fire,
      scheduleOutboundJob: schedule,
    } as unknown as CanonicalEventJobHandlerOptions);
    await handler.execute(job);
    expect(fire).toHaveBeenCalledWith(job);
    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryId: eventId, correlationId: eventId }),
    );
  });
  it('does not schedule suppressed/inactive reminders and fails closed without a publisher', async () => {
    await new CanonicalEventJobHandler({
      processRequestedReminder: async () => ({ deliveryId: null }),
    } as unknown as CanonicalEventJobHandlerOptions).execute(job);
    await expect(
      new CanonicalEventJobHandler({
        processRequestedReminder: async () => ({ deliveryId: eventId }),
      } as unknown as CanonicalEventJobHandlerOptions).execute(job),
    ).rejects.toThrow('publisher is unavailable');
  });
  it('replayed processed events recover fire-job signals without a second Brain call', async () => {
    const publish = vi.fn(async () => undefined),
      brain = vi.fn();
    const handler = new CanonicalEventJobHandler({
      events: { load: async () => ({ id: eventId, ownerId, processingStatus: 'processed' }) },
      brain: { process: brain },
      publishReminderJobsForEvent: publish,
    } as unknown as CanonicalEventJobHandlerOptions);
    await handler.execute({ ...job, jobType: 'jarvis.event.process' });
    expect(publish).toHaveBeenCalledWith(ownerId, eventId);
    expect(brain).not.toHaveBeenCalled();
  });
});
