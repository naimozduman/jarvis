import { Temporal } from '@js-temporal/polyfill';

export type OwnerReminderResolution =
  | {
      readonly state: 'resolved';
      readonly title: string;
      readonly scheduledFor: string;
      readonly timezone: string;
    }
  | { readonly state: 'clarify'; readonly question: string };

/** A deliberately bounded grammar. UTC offsets/durable identifiers never come from the model. */
export function resolveOwnerReminder(input: {
  readonly message: string;
  readonly requestedAt: string;
  readonly timezone: string | null;
}): OwnerReminderResolution {
  const clarify = (question: string): OwnerReminderResolution => ({ state: 'clarify', question });
  const text = input.message.trim();
  if (!/^(?:(?:please|can you|could you)\s+)?(?:remind me|text me)\b/iu.test(text))
    return clarify('Would you like me to schedule a reminder?');
  const subject = /\b(?:to|about)\s+(.+?)[.!?]*$/iu.exec(text)?.[1]?.trim();
  const title = subject && !/^(?:that|it|this)$/iu.test(subject) ? subject : undefined;
  if (!title || title.length > 512) return clarify('What should I remind you about?');
  if (!input.timezone)
    return clarify('I need your confirmed timezone before scheduling that reminder.');
  try {
    const instant = Temporal.Instant.from(input.requestedAt);
    const localNow = instant.toZonedDateTimeISO(input.timezone);
    const timingText = text.slice(0, text.length - (subject?.length ?? 0));
    if (
      /\b(?:on|next|yesterday|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/iu.test(
        timingText,
      ) ||
      /\d{4}-\d{2}-\d{2}/u.test(timingText)
    )
      return clarify('Please confirm the exact day and local time for that reminder.');
    if (/\b(?:don't|do not|not actually|hypothetically|if)\b/iu.test(text))
      return clarify('Please confirm whether you want me to schedule that reminder.');
    const relative = /\bin\s+(\d{1,4})\s*(minutes?|mins?|hours?|hrs?)\b/iu.exec(timingText);
    const clock = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/iu.exec(timingText);
    if (relative && (clock || /\b(?:today|tomorrow)\b/iu.test(timingText)))
      return clarify('Please confirm one exact reminder time.');
    let scheduled: Temporal.Instant;
    if (relative) {
      const minutes = Number(relative[1]) * (/^(?:hour|hr)/iu.test(relative[2]!) ? 60 : 1);
      if (minutes < 1 || minutes > 10080)
        return clarify('Please choose a reminder time within the next seven days.');
      scheduled = instant.add({ minutes });
    } else {
      if (!clock)
        return clarify(
          /\btomorrow morning\b/iu.test(timingText)
            ? 'What time tomorrow morning should I remind you?'
            : 'When should I remind you?',
        );
      const rawHour = Number(clock[1]);
      const minute = Number(clock[2] ?? 0);
      if (rawHour < 1 || rawHour > 12 || minute > 59)
        return clarify('What exact time should I use for that reminder?');
      const hour = (rawHour % 12) + (clock[3]!.toLowerCase() === 'pm' ? 12 : 0);
      let date = localNow.toPlainDate().add({ days: /\btomorrow\b/iu.test(timingText) ? 1 : 0 });
      const wall = () =>
        date
          .toPlainDateTime({ hour, minute })
          .toZonedDateTime(input.timezone!, { disambiguation: 'reject' })
          .toInstant();
      scheduled = wall();
      if (Temporal.Instant.compare(scheduled, instant) <= 0) {
        if (/\btoday\b/iu.test(timingText))
          return clarify('That time today has passed. What future time should I use?');
        date = date.add({ days: 1 });
        scheduled = wall();
      }
    }
    return {
      state: 'resolved',
      title,
      scheduledFor: new Date(scheduled.epochMilliseconds).toISOString(),
      timezone: input.timezone,
    };
  } catch {
    return clarify('That time or timezone is ambiguous. Please confirm the exact local time.');
  }
}
