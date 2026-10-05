import type { DailyUseCommitment } from '@jarvis/contracts';
import { AccountabilityEngine, type AccountabilityOutcome } from '../accountability/engine.js';

export interface DailyUseAccountability {
  readonly commitmentId: string;
  readonly outcome: AccountabilityOutcome;
  readonly explicitHardOverride: boolean;
  readonly title: string;
  readonly consequence: string | null;
  readonly consequencePreviouslyExplained: boolean;
}

/** Wording-only, conservative trigger; relevance is grounded in one exact canonical title. */
export function evaluateDailyUseAccountability(
  message: string,
  commitments: readonly DailyUseCommitment[],
): DailyUseAccountability | null {
  const text = message.normalize('NFKC').toLowerCase();
  if (
    !/(?:\bskip\b|\bmissed\b|\breplan\b|\bmove\b|hard override|kesin kararım|\batla\b|atlamak|yapmayacağım|kaçırdım|ertele|yeniden planla)/u.test(
      text,
    )
  )
    return null;
  if (/(?:\bnot\b|\bnever\b|\bdon['’]t\b|\bwon['’]t\b)\s+(?:\w+\s+)?skip\b/u.test(text))
    return null;
  const matches = commitments.filter((item) => {
    const title = item.title.normalize('NFKC').toLowerCase().trim();
    let at = text.indexOf(title);
    while (at >= 0) {
      const before = text[at - 1] ?? '',
        after = text[at + title.length] ?? '';
      if (!/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after)) return title.length >= 3;
      at = text.indexOf(title, at + 1);
    }
    return false;
  });
  if (matches.length !== 1) return null;
  const commitment = matches[0]!;
  const override = /^(?:hard override|kesin kararım):\s*(.+)$/u.exec(text.trim());
  const explicitHardOverride = Boolean(
    override &&
    /^(?:skip|move|replan|atla|ertele)\s+\S/u.test(override[1]!) &&
    !/(?:\bnot\b|\bdon['’]t\b|\bnever\b|\bmight\b|\bmaybe\b|\bdeğil\b|\batlama\b|[?])/u.test(
      override[1]!,
    ),
  );
  // Only an affirmative, first-person current-turn time statement supplies this constraint.
  // It can shorten a known window; it cannot invent another slot or alter a commitment.
  const statedWindow =
    /(?:^|[.!?;,]\s*)(?:i (?:only )?have (\d{1,3}) (?:minutes?|mins?)\b|(?:şu an )?sadece (\d{1,3}) dakik(?:a|am) var\b)/u.exec(
      text,
    );
  const statedMinutes = statedWindow ? Number(statedWindow[1] ?? statedWindow[2]) : null;
  const remainingMinutes =
    statedMinutes === null
      ? commitment.remainingMinutes
      : commitment.constraintsKnown
        ? Math.min(commitment.remainingMinutes, statedMinutes)
        : statedMinutes;
  const outcome = new AccountabilityEngine().evaluate({
    importance: commitment.importance,
    // Importance is not a constitution link; never invent constitutional relevance.
    constitutionalRelevance: 0,
    deadlineMinutes: commitment.deadlineMinutes,
    remainingMinutes,
    consequence: commitment.consequence,
    minimumAcceptableVersion: commitment.minimumAcceptableVersion,
    minimumMinutes: commitment.minimumMinutes,
    dependenciesMet: commitment.dependenciesMet,
    previousMisses: 0,
    alternateWindowsToday: commitment.alternateWindowsToday,
    nextProtectedWindowExists: commitment.nextProtectedWindowExists,
    explicitOwnerIntent: message,
    hardOverrideActive: commitment.hardOverrideActive || explicitHardOverride,
    ambiguityMatters:
      !commitment.constraintsKnown &&
      statedMinutes === null &&
      commitment.alternateWindowsToday === 0 &&
      !commitment.nextProtectedWindowExists &&
      (commitment.deadlineMinutes === null || commitment.deadlineMinutes > 0),
    alreadyChallenged: commitment.alreadyChallenged,
  });
  return {
    commitmentId: commitment.id,
    outcome,
    explicitHardOverride,
    title: commitment.title,
    consequence: commitment.consequence,
    consequencePreviouslyExplained: commitment.overrideConsequenceExplained === true,
  };
}
