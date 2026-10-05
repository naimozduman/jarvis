import { describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { OwnerBaselineProposal, OwnerBaselineReview } from '@jarvis/contracts';
import { modelDecisionEnvelopeSchema } from '../src/model/decision-schema.js';
import {
  extractOwnerBaselineProposals,
  isOwnerBaselineCapture,
  ownerBaselineControl,
} from '../src/conversation/owner-baseline.js';

const messageId = randomUUID();
const proposal: OwnerBaselineProposal = {
  kind: 'preference',
  title: 'Answers',
  statement: 'I prefer short direct answers.',
  sourceQuote: 'I prefer short direct answers.',
  confidenceBasisPoints: 9000,
  sensitivity: 'normal',
  temporary: false,
  validUntil: null,
  personalContextName: null,
};
function envelope(value = proposal, evidenceIds = [messageId]) {
  return modelDecisionEnvelopeSchema.parse({
    decisionType: 'capture',
    conversationResponse: null,
    reasoningSummary: {
      decisionSummary: 'Synthetic extraction',
      importantEvidenceIds: [],
      materialTradeoffs: [],
      confidenceBasisPoints: 9000,
      missingInformation: [],
    },
    evidence: [],
    clarification: null,
    proposedActions: [],
    memoryCandidates: [
      {
        kind: 'preference',
        normalizedStatement: JSON.stringify(value),
        authority: 'owner_review',
        evidenceIds,
        confidenceBasisPoints: 10000,
        sensitivity: 'normal',
        validFrom: null,
        validTo: null,
        reviewAt: null,
        requiresOwnerConfirmation: false,
        relatedEntityIds: [],
      },
    ],
    planProposal: null,
    reminderProposal: null,
    interventionProposal: null,
  });
}
const review: OwnerBaselineReview = {
  questionnaireId: randomUUID(),
  revision: 'current',
  items: [1, 2].map((ordinal) => ({
    ...proposal,
    ordinal,
    candidateId: randomUUID(),
    excluded: false,
    acceptedMemoryRecordId: null,
    constitutionItemId: null,
    entityId: null,
  })),
  reviewed: false,
  presentedRevision: 'current',
  pendingCorrection: null,
};
function control(message: string, value: OwnerBaselineReview | null = review) {
  return ownerBaselineControl({
    message,
    review: value,
    questionnaireId: review.questionnaireId,
    timezone: 'America/Chicago',
  });
}

describe('owner-authored baseline boundaries', () => {
  test.each([
    ['me', 'Ozan is my mentor.'],
    ['Mira', 'Miranda is a friend.'],
  ])('rejects a substring masquerading as a personal name: %s', (title, quote) =>
    expect(() =>
      extractOwnerBaselineProposals(
        envelope({ ...proposal, kind: 'person', title, statement: quote, sourceQuote: quote }),
        quote,
        messageId,
      ),
    ).toThrow('explicitly owner-authored'),
  );
  test.each([
    'My baseline: ...',
    'My main goals for the next 12 months are ...',
    "These are the projects I'm actively working on ...",
    'These things are non-negotiable for me ...',
    'I prefer short direct answers unless I ask for detail.',
    'This person is important to me because ...',
    "I'm trying to accomplish X before Y.",
    'Benim kişisel temelim: ...',
    'Hedefler: ...',
  ])('recognizes deliberate baseline input: %s', (text) =>
    expect(isOwnerBaselineCapture(text)).toBe(true),
  );
  test.each([
    'hello',
    'too long',
    'My friend says he prefers short answers.',
    'Remind me tomorrow.',
    'yes',
    'That was good.',
  ])('leaves unrelated conversation alone: %s', (text) =>
    expect(isOwnerBaselineCapture(text)).toBe(false),
  );
  test('admits current-message evidence while ignoring model-selected authority and activation', () =>
    expect(extractOwnerBaselineProposals(envelope(), proposal.sourceQuote, messageId)).toEqual([
      proposal,
    ]));
  test.each([
    'My main goal is to build Atlas.',
    'Never send money.',
    'I promise to call family every week.',
  ])('keeps protected material as a constitution draft: %s', (text) =>
    expect(
      extractOwnerBaselineProposals(
        envelope({ ...proposal, kind: 'fact', statement: text, sourceQuote: text }),
        text,
        messageId,
      )[0]?.kind,
    ).toBe('constitution_candidate'),
  );
  test('uses the owner goal heading, even if the model mislabels the item as a fact', () =>
    expect(
      extractOwnerBaselineProposals(
        envelope({
          ...proposal,
          kind: 'fact',
          statement: 'Build Atlas.',
          sourceQuote: 'Build Atlas.',
        }),
        'My baseline:\nGoals:\nBuild Atlas.',
        messageId,
      )[0]?.kind,
    ).toBe('constitution_candidate'));
  test('uncertain statements remain hypotheses rather than facts or traits', () =>
    expect(
      extractOwnerBaselineProposals(
        envelope({
          ...proposal,
          kind: 'fact',
          statement: 'Maybe I work best in the morning.',
          sourceQuote: 'Maybe I work best in the morning.',
        }),
        'Maybe I work best in the morning.',
        messageId,
      )[0],
    ).toMatchObject({ kind: 'hypothesis', confidenceBasisPoints: 6000 }));
  test('requires current provenance, not prior history or fabricated quotation', () => {
    expect(() =>
      extractOwnerBaselineProposals(envelope(), 'Unrelated owner text', messageId),
    ).toThrow('verbatim');
    expect(() =>
      extractOwnerBaselineProposals(
        envelope(proposal, [randomUUID()]),
        proposal.sourceQuote,
        messageId,
      ),
    ).toThrow('canonical owner message');
  });
  test('raises people and relationship sensitivity and never invents a temporary expiry', () => {
    const quote = 'Mira is my mentor.';
    expect(
      extractOwnerBaselineProposals(
        envelope({
          ...proposal,
          kind: 'person',
          title: 'Mira',
          statement: quote,
          sourceQuote: quote,
          temporary: true,
          validUntil: '2027-01-01T00:00:00.000Z',
        }),
        quote,
        messageId,
      )[0],
    ).toMatchObject({ sensitivity: 'sensitive', temporary: true, validUntil: null });
  });
});
describe('provider-free exact owner review commands', () => {
  test.each(['yes, save those', 'yes save these', 'save my baseline', 'evet, bunları kaydet'])(
    'requires explicit confirmation: %s',
    (text) => expect(control(text)?.operation).toBe('confirm'),
  );
  test.each([
    'yes',
    'do it',
    'save all and transfer money',
    'My friend said yes, save those',
    'not sure, save those',
  ])('rejects ambiguous or composite consent: %s', (text) => expect(control(text)).toBeNull());
  test('asks for an item number when “not that one” is ambiguous', () =>
    expect(control('not that one')).toMatchObject({
      operation: 'exclude',
      ordinal: null,
      pendingCorrection: { operation: 'exclude', ordinal: null },
    }));
  test('binds a numbered exclusion and correction without a model', () => {
    expect(control('not that one 2')).toMatchObject({ operation: 'exclude', ordinal: 2 });
    expect(control('change 2 to I prefer a two-sentence answer.')).toMatchObject({
      operation: 'change',
      ordinal: 2,
      replacement: 'I prefer a two-sentence answer',
    });
    expect(control("that's not a goal 2")).toMatchObject({ operation: 'not_goal', ordinal: 2 });
  });
  test('resolves explicit temporary date in the canonical owner timezone and asks if no expiry', () => {
    expect(control('temporary 2 until 2026-11-05')).toMatchObject({
      validUntil: '2026-11-06T06:00:00Z',
    });
    expect(control("that's temporary 2")).toMatchObject({
      pendingCorrection: { operation: 'temporary', ordinal: 2 },
      validUntil: null,
    });
  });
  test('supports the next turn supplying the missing number or replacement', () => {
    expect(
      control('2', { ...review, pendingCorrection: { operation: 'exclude', ordinal: null } }),
    ).toMatchObject({ operation: 'exclude', ordinal: 2 });
    expect(
      control('Only this month', {
        ...review,
        pendingCorrection: { operation: 'change', ordinal: 2 },
      }),
    ).toMatchObject({ operation: 'change', ordinal: 2, replacement: 'Only this month' });
    expect(control('2')).toBeNull();
  });
});
