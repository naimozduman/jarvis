import { describe, expect, test } from 'vitest';

import type { ContextRecord } from '@jarvis/contracts';
import { ContextAssembler } from '../src/context/assembler.js';
import {
  materializeModelDecision,
  ModelDecisionValidationError,
} from '../src/conversation/model-decision-mapper.js';

const ownerId = '00000000-0000-4000-8000-000000000001';
const commitmentId = '00000000-0000-4000-8000-000000000010';
const currentMessageId = '00000000-0000-4000-8000-000000000011';
const oldMessageId = '00000000-0000-4000-8000-000000000012';
const now = '2026-10-02T12:00:00.000Z';

function record(
  recordId: string,
  recordType: ContextRecord['recordType'],
  content: string,
): ContextRecord {
  return {
    recordId,
    recordType,
    ownerId,
    source: 'internal',
    informationState: 'known',
    confidenceBasisPoints: 10_000,
    sensitivity: 'normal',
    observedAt: now,
    content,
    entityReferences: [],
    constitutionalRelevance: 70,
    activeCommitmentRelevance: 80,
    deadlineProximityMinutes: 180,
    currentDayRelevance: 85,
    sourceAuthority: 100,
  };
}

function completionInput(ownerMessage: string) {
  const request = {
    id: '00000000-0000-4000-8000-000000000020',
    ownerId,
    conversationId: '00000000-0000-4000-8000-000000000002',
    sourceEventId: null,
    messageId: currentMessageId,
    purpose: 'conversation' as const,
    idempotencyKey: 'synthetic-completion-evidence',
    correlationId: '00000000-0000-4000-8000-000000000003',
    causationId: null,
    requestedAt: now,
    state: 'received' as const,
  };
  const context = new ContextAssembler({
    maxContextRecords: 32,
    maxRecentMessages: 12,
    maxApproxPromptTokens: 6_000,
  }).assemble({
    request,
    now,
    records: [
      record(commitmentId, 'commitment', 'An open workout commitment.'),
      record(currentMessageId, 'message', ownerMessage),
      record(oldMessageId, 'message', 'JARVIS: Reminder: workout. No owner response.'),
    ],
    hardOverrideIds: [],
    availableData: [],
  });
  return {
    rawDecision: {
      decisionType: 'answer',
      conversationResponse: {
        message: 'Synthetic completion claim.',
        nextAction: null,
        tone: 'neutral',
      },
      reasoningSummary: {
        decisionSummary: 'Synthetic self-report.',
        importantEvidenceIds: [],
        materialTradeoffs: [],
        confidenceBasisPoints: 7_000,
        missingInformation: [],
      },
      evidence: [],
      clarification: null,
      proposedActions: [
        {
          actionType: 'internal.commitment.update',
          riskClass: 'LOW_RISK_INTERNAL',
          targetRecordId: commitmentId,
          title: null,
          scheduledFor: null,
          completionEvidenceId: currentMessageId,
          planProposalReference: null,
          rationale: 'The owner explicitly reported completion.',
          evidenceIds: [commitmentId, currentMessageId],
        },
      ],
      memoryCandidates: [],
      planProposal: null,
      reminderProposal: null,
      interventionProposal: null,
    },
    context,
    decisionId: '00000000-0000-4000-8000-000000000021',
    now,
    existingPlanBlocks: [],
    allowedDayPlanIds: [],
    isSupportedIntervention: () => false,
    ownerMessage,
  };
}

describe('current owner completion evidence', () => {
  test.each([
    'I completed my workout.',
    "I've finished my workout.",
    'I have just completed my workout.',
    'I did my workout.',
    "I'm done with my workout.",
    'I am all done with my workout.',
    'Antrenmanı bitirdim.',
    'Ben antrenmanımı tamamladım.',
    'Antrenmanı yaptım.',
    'Antrenmani tamamladim.',
    "Workout'ımı bitirdim.",
    'ANTRENMANIMI TAMAMLADIM.',
  ])('accepts a current affirmative owner assertion: %s', (ownerMessage) => {
    const result = materializeModelDecision(completionInput(ownerMessage));
    expect(result.decision.proposedActions[0]).toMatchObject({
      actionType: 'internal.commitment.update',
      targetRecordId: commitmentId,
      completionEvidenceId: currentMessageId,
    });
  });

  test.each([
    '',
    'No response.',
    'Reminder: workout.',
    "I haven't finished my workout.",
    'I did not complete my workout.',
    'I did nothing.',
    'I did no workout.',
    'I completed none of my workout.',
    'I did zero minutes of my workout.',
    'I will finish my workout.',
    'I plan to complete my workout.',
    'I did plan to finish my workout.',
    'I did expect to finish my workout.',
    'I said I finished my workout.',
    'My coach says I finished my workout.',
    '"I finished my workout."',
    'I think I finished my workout.',
    'I finished my workout?',
    'I finished half of my workout.',
    'Antrenmanı bitirmedim.',
    'Antrenmanı yapmadım.',
    'Antrenmanı yarın yapacağım.',
    'Antrenmanı yapmayı planlıyorum.',
    'Antrenmanı bitirdim dedi.',
    'Ahmet: antrenmanı bitirdim.',
    'Sanırım antrenmanı bitirdim.',
    'Antrenmanı bitirdim mi?',
    'Antrenmanın yarısını yaptım.',
  ])(
    'rejects silence, negation, plans, uncertainty and reported completion: %s',
    (ownerMessage) => {
      expect(() => materializeModelDecision(completionInput(ownerMessage))).toThrow(
        ModelDecisionValidationError,
      );
    },
  );

  test('a current canonical assertion remains usable when bounded context omits its message record', () => {
    const input = completionInput('I finished my workout.');
    input.context.records = input.context.records.filter(
      (item) => item.recordId !== currentMessageId,
    );
    input.context.manifest.selectedRecords = input.context.manifest.selectedRecords.filter(
      (item) => item.recordId !== currentMessageId,
    );
    expect(materializeModelDecision(input).decision.proposedActions[0]!.completionEvidenceId).toBe(
      currentMessageId,
    );
  });

  test('missing original owner input cannot be replaced by context completion prose', () => {
    const input = completionInput('I finished my workout.');
    expect(() => materializeModelDecision({ ...input, ownerMessage: undefined })).toThrow(
      ModelDecisionValidationError,
    );
  });

  test('an unbound inbound message cannot authorize completion', () => {
    const input = completionInput('I finished my workout.');
    input.context.request.messageId = null;
    expect(() => materializeModelDecision(input)).toThrow(ModelDecisionValidationError);
  });

  test.each(['reminder delivery', 'older owner assertion'])(
    'a visible %s cannot replace current inbound completion evidence',
    (source) => {
      const input = completionInput('I finished my workout.');
      if (source === 'older owner assertion') {
        input.context.records.find((item) => item.recordId === oldMessageId)!.content =
          'Owner: I finished my workout.';
      }
      input.rawDecision.proposedActions[0]!.completionEvidenceId = oldMessageId;
      expect(() => materializeModelDecision(input)).toThrow(ModelDecisionValidationError);
    },
  );

  test.each(['unavailable', 'foreign owner', 'duplicate visible records'])(
    'ambiguous commitment visibility fails closed: %s',
    (kind) => {
      const input = completionInput('I finished my workout.');
      if (kind === 'unavailable') {
        input.context.manifest.selectedRecords = input.context.manifest.selectedRecords.filter(
          (item) => item.recordId !== commitmentId,
        );
      } else if (kind === 'foreign owner') {
        input.context.records.find((item) => item.recordId === commitmentId)!.ownerId =
          '00000000-0000-4000-8000-000000000099';
      } else {
        input.context.records.push(record(commitmentId, 'commitment', 'A conflicting commitment.'));
      }
      expect(() => materializeModelDecision(input)).toThrow(ModelDecisionValidationError);
    },
  );

  test.each(['inferred', 'conflicting', 'missing', 'stale'] as const)(
    'an uncertain commitment cannot authorize completion: %s',
    (informationState) => {
      const input = completionInput('I finished my workout.');
      input.context.records.find((item) => item.recordId === commitmentId)!.informationState =
        informationState;
      expect(() => materializeModelDecision(input)).toThrow(ModelDecisionValidationError);
    },
  );
});
