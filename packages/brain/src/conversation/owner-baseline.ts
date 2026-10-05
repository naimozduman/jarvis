import { Temporal } from '@js-temporal/polyfill';
import {
  ownerBaselineProposalSchema,
  ownerNamesPersonalContext,
  type OwnerBaselineOperation,
  type OwnerBaselineProposal,
  type OwnerBaselineReview,
} from '@jarvis/contracts';
import type { ModelDecisionEnvelope } from '../model/decision-schema.js';

export { isOwnerBaselineCapture } from '@jarvis/contracts';

/** Exact review verbs are server decisions, never model-selected activation intents. */
export function ownerBaselineControl(input: {
  message: string;
  review: OwnerBaselineReview | null;
  questionnaireId: string;
  timezone: string | null;
}): OwnerBaselineOperation | null {
  const text = input.message.trim().replace(/[.!?]+$/u, '');
  const review = input.review;
  const base: OwnerBaselineOperation = {
    questionnaireId: review?.questionnaireId ?? input.questionnaireId,
    expectedRevision: review?.revision ?? null,
    operation: 'review',
    proposals: [],
    ordinal: null,
    replacement: null,
    validUntil: null,
    pendingCorrection: null,
  };
  if (
    /^(?:(?:start|review|show)(?: my)? (?:personal )?baseline|(?:kişisel )?temelimi (?:başlat|göster|incele))$/iu.test(
      text,
    )
  )
    return base;
  if (!review) return null;
  if (
    /^(?:yes,? (?:save|confirm|approve) (?:those|these|them|my baseline)|save (?:those|these|my baseline)|evet,? (?:bunları kaydet|onayla))$/iu.test(
      text,
    )
  )
    return { ...base, operation: 'confirm' };
  const command =
    /^(not that one|exclude|remove|change(?: this)?|that['’]?s temporary|temporary|that['’]?s not a goal|not a goal|bunu çıkar|değiştir|bu geçici|bu bir hedef değil)(?:\s+(?:item\s+|madde\s+)?(\d{1,2}))?(?:\s*(?:to|:|olarak)\s+(.+)|\s+until\s+(\d{4}-\d{2}-\d{2}))?$/iu.exec(
      text,
    );
  if (command) {
    const verb = command[1]!.toLowerCase();
    const operation = /temporary|geçici/u.test(verb)
      ? 'temporary'
      : /goal|hedef/u.test(verb)
        ? 'not_goal'
        : /change|değiştir/u.test(verb)
          ? 'change'
          : 'exclude';
    const ordinal = command[2]
      ? Number(command[2])
      : review.items.filter((item) => !item.excluded).length === 1
        ? review.items.find((item) => !item.excluded)!.ordinal
        : null;
    if (ordinal !== null && (ordinal < 1 || ordinal > 24)) return base;
    let validUntil: string | null = null;
    if (command[4] && input.timezone) {
      try {
        validUntil = Temporal.PlainDate.from(command[4])
          .add({ days: 1 })
          .toZonedDateTime({ timeZone: input.timezone, plainTime: '00:00' })
          .toInstant()
          .toString();
      } catch {
        /* Ask for a valid owner-local date. */
      }
    }
    return {
      ...base,
      operation,
      ordinal,
      replacement: command[3] ?? null,
      validUntil,
      pendingCorrection:
        ordinal === null ||
        (operation === 'change' && !command[3]) ||
        (operation === 'temporary' && !validUntil)
          ? { operation, ordinal }
          : null,
    };
  }
  if (review.pendingCorrection) {
    const target = /^(?:item\s+|madde\s+)?(\d{1,2})$/iu.exec(text);
    if (target && Number(target[1]) >= 1 && Number(target[1]) <= 24)
      return {
        ...base,
        operation: review.pendingCorrection.operation,
        ordinal: Number(target[1]),
        pendingCorrection: ['change', 'temporary'].includes(review.pendingCorrection.operation)
          ? { ...review.pendingCorrection, ordinal: Number(target[1]) }
          : null,
      };
    if (
      review.pendingCorrection.ordinal &&
      review.pendingCorrection.operation === 'change' &&
      text.length <= 800
    )
      return {
        ...base,
        operation: 'change',
        ordinal: review.pendingCorrection.ordinal,
        replacement: text,
      };
    if (
      review.pendingCorrection.ordinal &&
      review.pendingCorrection.operation === 'temporary' &&
      /^until \d{4}-\d{2}-\d{2}$/u.test(text)
    )
      return ownerBaselineControl({
        ...input,
        message: `temporary ${review.pendingCorrection.ordinal} ${text}`,
      });
  }
  return null;
}

function durableBoundary(quote: string, ownerMessage: string): boolean {
  const before = ownerMessage.slice(0, ownerMessage.indexOf(quote));
  const heading =
    before
      .split('\n')
      .reverse()
      .find((line) => /:\s*$/u.test(line)) ?? '';
  return (
    /\b(goal|goals|non-negotiable|must|never|always|standing (?:rule|promise)|prohibit|promise to|every (?:day|week|month))\b|hedef|vazgeçilmez|asla|her (?:gün|hafta|ay)|kesin kural/iu.test(
      quote,
    ) || /goals|rules|constraints|non-negotiables|hedefler|kurallar|sınırlar/iu.test(heading)
  );
}

/** All extraction remains draft evidence. No model action, ID, activation or authority is used. */
export function extractOwnerBaselineProposals(
  envelope: ModelDecisionEnvelope,
  message: string,
  messageId: string,
): readonly OwnerBaselineProposal[] {
  if (envelope.memoryCandidates.length < 1 || envelope.memoryCandidates.length > 24)
    throw new Error('A baseline extraction requires a bounded candidate review.');
  const proposals: OwnerBaselineProposal[] = [];
  for (const candidate of envelope.memoryCandidates) {
    if (
      !candidate.evidenceIds.includes(messageId) ||
      candidate.evidenceIds.some((id) => id !== messageId)
    )
      throw new Error('Baseline candidates require only this canonical owner message.');
    const parsed = ownerBaselineProposalSchema.parse(JSON.parse(candidate.normalizedStatement));
    if (!message.includes(parsed.sourceQuote))
      throw new Error(
        'A baseline quote must occur verbatim in the current owner-authored message.',
      );
    if (
      (parsed.kind === 'person' || parsed.kind === 'relationship') &&
      !ownerNamesPersonalContext(parsed.title, parsed.sourceQuote)
    )
      throw new Error('A personal baseline name must be explicitly owner-authored.');
    const uncertain =
      /\b(maybe|might|possibly|perhaps|i think|i guess|not sure)\b|belki|emin değilim/iu.test(
        parsed.sourceQuote,
      ) || parsed.confidenceBasisPoints < 7_000;
    const kind = uncertain
      ? 'hypothesis'
      : durableBoundary(parsed.sourceQuote, message)
        ? 'constitution_candidate'
        : parsed.kind;
    const personal =
      parsed.kind === 'person' ||
      parsed.kind === 'relationship' ||
      /health|medical|diagnos|relationship|partner|family|sağlık|ilişki|aile/iu.test(
        parsed.sourceQuote,
      );
    const expiryGrounded =
      parsed.validUntil !== null && parsed.sourceQuote.includes(parsed.validUntil.slice(0, 10));
    const proposal: OwnerBaselineProposal = {
      ...parsed,
      kind,
      personalContextName:
        personal && ownerNamesPersonalContext(parsed.title, parsed.sourceQuote)
          ? parsed.title
          : null,
      validUntil: expiryGrounded ? parsed.validUntil : null,
      confidenceBasisPoints: Math.min(parsed.confidenceBasisPoints, uncertain ? 6_000 : 9_000),
      sensitivity:
        personal && !ownerNamesPersonalContext(parsed.title, parsed.sourceQuote)
          ? 'restricted'
          : personal && parsed.sensitivity === 'normal'
            ? 'sensitive'
            : parsed.sensitivity,
    };
    if (
      !proposals.some(
        (item) =>
          item.kind === proposal.kind &&
          item.statement.toLocaleLowerCase('en-US') ===
            proposal.statement.toLocaleLowerCase('en-US'),
      )
    )
      proposals.push(proposal);
  }
  if (
    proposals.some((item, index) =>
      proposals.some(
        (other, otherIndex) =>
          otherIndex < index &&
          ((other.kind === item.kind &&
            other.title.toLocaleLowerCase('en-US') === item.title.toLocaleLowerCase('en-US')) ||
            other.statement.toLocaleLowerCase('en-US') ===
              item.statement.toLocaleLowerCase('en-US')),
      ),
    )
  )
    throw new Error(
      'Conflicting baseline items need distinct review labels or one combined conditional preference.',
    );
  if (
    proposals.reduce((total, item) => total + item.statement.length + item.title.length + 100, 0) >
    3000
  )
    throw new Error(
      'A baseline review must fit the existing conversational surface. Send a smaller batch.',
    );
  return proposals;
}
