import { describe, expect, it } from 'vitest';
import { resolveOwnerReminder } from '../src/reminders/owner-reminder-time.js';
import { modelReminderProposalSchema } from '../src/model/decision-schema.js';

const base = { requestedAt: '2026-10-01T17:00:00.000Z', timezone: 'America/Chicago' };
describe('owner reminder canonical time boundary', () => {
  it.each([
    'Remind me in 10 minutes to take a shower',
    'Text me in 10 minutes and remind me to take a shower',
    'text me in 10 minutes and remind me about getting shower',
  ])('%s uses the request instant, not a model offset', (message) => {
    expect(resolveOwnerReminder({ ...base, message })).toMatchObject({
      state: 'resolved',
      scheduledFor: '2026-10-01T17:10:00.000Z',
    });
  });
  it('resolves 6:30 PM in the canonical IANA owner timezone', () => {
    expect(
      resolveOwnerReminder({ ...base, message: 'Remind me at 6:30 PM to leave' }),
    ).toMatchObject({
      state: 'resolved',
      title: 'leave',
      scheduledFor: '2026-10-01T23:30:00.000Z',
    });
    expect(
      resolveOwnerReminder({
        ...base,
        timezone: 'Europe/Istanbul',
        message: 'Remind me at 6:30 PM to leave',
      }),
    ).toMatchObject({ state: 'resolved', scheduledFor: '2026-10-02T15:30:00.000Z' });
  });
  it.each([
    'Remind me tomorrow morning to call Kerem',
    'Remind me about that',
    'Remind me in 10 minutes about that',
    "don't remind me in 10 minutes to take a shower",
    "I said 'remind me in 10 minutes to take a shower'",
    'Remind me on Tuesday at 6:30 PM to leave',
    'Remind me next week at 6:30 PM to leave',
  ])('%s clarifies instead of guessing authority, referent or time', (message) => {
    expect(resolveOwnerReminder({ ...base, message }).state).toBe('clarify');
  });
  it('does not silently roll an explicit past today forward', () => {
    expect(
      resolveOwnerReminder({
        ...base,
        requestedAt: '2026-10-02T01:00:00.000Z',
        message: 'Remind me today at 6:30 PM to leave',
      }).state,
    ).toBe('clarify');
  });
  it('subject prose cannot override the request timing segment', () => {
    expect(
      resolveOwnerReminder({
        ...base,
        message: 'Remind me at 6:30 PM to ask Kerem about leaving in 10 minutes',
      }),
    ).toMatchObject({ state: 'resolved', scheduledFor: '2026-10-01T23:30:00.000Z' });
    expect(
      resolveOwnerReminder({ ...base, message: 'Remind me in 10 minutes at 6:30 PM to leave' })
        .state,
    ).toBe('clarify');
  });
  it.each([null, 'Invalid/Timezone'])(
    'fails closed without a confirmed timezone %s',
    (timezone) => {
      expect(
        resolveOwnerReminder({ ...base, timezone, message: 'Remind me in 10 minutes to leave' })
          .state,
      ).toBe('clarify');
    },
  );
  it.each(['2026-03-08T06:00:00.000Z', '2026-11-01T05:00:00.000Z'])(
    'rejects ambiguous/nonexistent DST wall time at %s',
    (requestedAt) => {
      const clock = requestedAt.includes('03-08') ? '2:30 AM' : '1:30 AM';
      expect(
        resolveOwnerReminder({ ...base, requestedAt, message: `Remind me at ${clock} to leave` })
          .state,
      ).toBe('clarify');
    },
  );
  it('model intent cannot provide durable IDs, guessed UTC time or executable names', () => {
    const intent = {
      commitmentId: null,
      title: 'shower',
      timeExpression: 'in 10 minutes',
      rationale: 'Owner request',
    };
    expect(modelReminderProposalSchema.safeParse(intent).success).toBe(true);
    for (const field of [
      'ownerId',
      'reminderId',
      'jobId',
      'scheduledFor',
      'actionType',
      'destination',
    ]) {
      expect(
        modelReminderProposalSchema.safeParse({ ...intent, [field]: 'invented' }).success,
      ).toBe(false);
    }
  });
});
