import { randomUUID } from 'node:crypto';

import type {
  BrainContext,
  BrainDecision,
  BrainEvidence,
  ContextRecord,
  MemoryCandidate,
  PlanBlock,
  PlanningCommitment,
  PlanProposal,
  ReminderProposal,
} from '@jarvis/contracts';

import { commitmentPlanBlock, schedulableCommitment, planBlockSchema } from '@jarvis/contracts';

import { evaluateMemoryPromotion } from '../memory/promotion-policy.js';
import {
  modelDecisionEnvelopeSchema,
  type ModelDecisionEnvelope,
} from '../model/decision-schema.js';
import { validatePlanProposal } from '../planning/constraint-validator.js';
import { resolveOwnerReminder } from '../reminders/owner-reminder-time.js';

export class ModelDecisionValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ModelDecisionValidationError';
  }
}

export interface MaterializedModelDecision {
  readonly modelDecision: ModelDecisionEnvelope;
  readonly decision: BrainDecision;
  readonly memoryCandidates: readonly MemoryCandidate[];
  readonly planProposal: PlanProposal | null;
  readonly reminderProposal: ReminderProposal | null;
}

function requiredVisibleRecord(
  records: ReadonlyMap<string, ContextRecord>,
  recordId: string,
  field: string,
): ContextRecord {
  const record = records.get(recordId);
  if (!record) {
    throw new ModelDecisionValidationError(
      `The model referenced a ${field} record not present in the context manifest.`,
    );
  }
  return record;
}

function evidenceForRecord(record: ContextRecord): BrainEvidence {
  return {
    recordId: record.recordId,
    recordType: record.recordType,
    source: record.source,
    informationState: record.informationState,
    observedAt: record.observedAt,
    confidenceBasisPoints: record.confidenceBasisPoints,
    sensitivity: record.sensitivity,
  };
}

/** Bounded self-report grammar; uncertain, quoted and mixed claims require clarification. */
function isExplicitOwnerCompletion(message: string | undefined): boolean {
  if (!message?.trim()) return false;
  const statement = message
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\u0307/gu, '')
    .trim();
  if (
    /[\n:?？]/u.test(statement) ||
    /\b(?:not|never|didn['’]t|haven['’]t|hasn['’]t|isn['’]t|wasn['’]t|maybe|perhaps|apparently|if|said|says|told|reported|half|halfway|almost|nearly|partially|except)\b/u.test(
      statement,
    ) ||
    /\b(?:did|completed|finished|done)\s+(?:no|none|nothing|zero|0)\b/u.test(statement) ||
    /\b(?:according to|i think|i guess|i did (?:plan|intend|hope|want|think|say|tell|report|try|expect|promise|decide|schedule))\b/u.test(
      statement,
    ) ||
    /\b(?:san[ıi]r[ıi]m|galiba|belki|umar[ıi]m|sanki|eğer|eger|göre|gore|dedi|dedim|söyledi|soyledi|bitirmedim|tamamlamad[ıi]m|yapmad[ıi]m|değil|degil)\b/u.test(
      statement,
    ) ||
    /\b(?:yar[ıi]s[ıi](?:n[ıi])?|k[ıi]smen|neredeyse)(?=\s|[.!?,]|$)/u.test(statement)
  )
    return false;
  const english =
    /^(?:i(?:['’]ve| have)\s+(?:(?:just|already|finally)\s+)?(?:completed|finished|done)\b|i\s+(?:(?:just|already|finally)\s+)?(?:completed|finished|did)\b|i(?:['’]m| am)\s+(?:all\s+)?done\b)/u;
  const turkish =
    /^(?:ben\s+)?[^.!?\n]*(?:\bbitirdim|\btamamlad[ıi]m|\byapt[ıi]m)(?:\s+(?:bile|art[ıi]k|tamamen))?[.!]*$/u;
  return english.test(statement) || turkish.test(statement);
}

/**
 * Verifies every model reference against the exact persisted ContextManifest, then gives the model
 * no control over IDs, owner scope, timestamps, or durable candidate state.
 */
export function materializeModelDecision(input: {
  readonly rawDecision: unknown;
  readonly context: BrainContext;
  readonly decisionId: string;
  readonly now: string;
  readonly existingPlanBlocks: readonly PlanBlock[];
  readonly canonicalCommitments?: readonly PlanningCommitment[];
  readonly authorizedNewFlexibleBlockTitles?: readonly string[] | undefined;
  readonly allowedDayPlanIds: readonly string[];
  /** Original current owner input, supplied by the server rather than model/context prose. */
  readonly ownerMessage?: string | undefined;
  readonly ownerReminderSource?: {
    readonly deliveryAvailable: boolean;
    readonly message: string;
    readonly requestedAt: string;
    readonly timezone: string | null;
  };
  readonly isSupportedIntervention: (interventionId: string) => boolean;
}): MaterializedModelDecision {
  const parsed = modelDecisionEnvelopeSchema.safeParse(input.rawDecision);
  if (!parsed.success) {
    throw new ModelDecisionValidationError(
      'The model response did not satisfy the strict brain decision schema.',
    );
  }
  const modelDecision = parsed.data;
  if (
    /^(?:(?:please|can you|could you)\s+)?(?:remind me|text me)\b/iu.test(
      input.ownerReminderSource?.message ?? '',
    ) &&
    !modelDecision.reminderProposal &&
    !modelDecision.clarification?.blocking
  ) {
    throw new ModelDecisionValidationError(
      'An explicit reminder request requires a typed reminder intent or a blocking clarification.',
    );
  }
  const records = new Map(input.context.records.map((record) => [record.recordId, record]));
  const visibleIds = new Set(
    input.context.manifest.selectedRecords.map((record) => record.recordId),
  );

  const ensureVisible = (recordId: string, field: string): ContextRecord => {
    if (!visibleIds.has(recordId)) {
      throw new ModelDecisionValidationError(
        `The model invented a ${field} reference outside the context manifest.`,
      );
    }
    return requiredVisibleRecord(records, recordId, field);
  };
  const ensureVisibleCommitment = (commitmentId: string, field: string): void => {
    const record = ensureVisible(commitmentId, field);
    if (record.recordType !== 'commitment' || record.informationState !== 'known') {
      throw new ModelDecisionValidationError(
        `The model used a ${field} reference that is not an owner-scoped commitment.`,
      );
    }
  };

  const evidence = modelDecision.evidence.map((reference) => {
    const record = ensureVisible(reference.recordId, 'evidence');
    if (reference.informationState !== record.informationState) {
      throw new ModelDecisionValidationError(
        'The model changed the epistemic state of cited evidence.',
      );
    }
    return evidenceForRecord(record);
  });
  const evidenceIds = new Set(evidence.map((item) => item.recordId));
  for (const recordId of modelDecision.reasoningSummary.importantEvidenceIds) {
    if (!evidenceIds.has(recordId)) {
      throw new ModelDecisionValidationError(
        'The decision summary cited evidence that was not supplied in its evidence list.',
      );
    }
  }
  for (const recordId of modelDecision.clarification?.relatedRecordIds ?? []) {
    ensureVisible(recordId, 'clarification');
  }
  for (const action of modelDecision.proposedActions) {
    if (action.targetRecordId) {
      ensureVisible(action.targetRecordId, 'action target');
    }
    const completion = action.actionType === 'internal.commitment.update';
    if (completion) {
      if (
        !action.targetRecordId ||
        !input.context.request.messageId ||
        action.completionEvidenceId !== input.context.request.messageId ||
        !isExplicitOwnerCompletion(input.ownerMessage)
      )
        throw new ModelDecisionValidationError(
          'Commitment completion requires the current owner message and an explicit completion assertion.',
        );
      ensureVisibleCommitment(action.targetRecordId, 'commitment action target');
      const targets = input.context.records.filter(
        (record) => record.recordId === action.targetRecordId,
      );
      if (targets.length !== 1 || targets[0]!.ownerId !== input.context.request.ownerId)
        throw new ModelDecisionValidationError(
          'Commitment completion requires one unambiguous owner-scoped target.',
        );
    }
    // The canonical current input remains evidence even if bounded retrieval omits its record.
    // Other evidence references still require the exact persisted visibility manifest.
    if (action.completionEvidenceId && !completion) {
      ensureVisible(action.completionEvidenceId, 'completion evidence');
    }
    for (const recordId of action.evidenceIds) {
      if (completion && recordId === input.context.request.messageId) continue;
      ensureVisible(recordId, 'action evidence');
    }
  }
  if (
    modelDecision.interventionProposal &&
    !input.isSupportedIntervention(modelDecision.interventionProposal.interventionId)
  ) {
    throw new ModelDecisionValidationError(
      'The model selected a behavioral intervention outside the approved registry.',
    );
  }
  if (modelDecision.interventionProposal?.commitmentId) {
    ensureVisibleCommitment(
      modelDecision.interventionProposal.commitmentId,
      'intervention commitment',
    );
  }
  if (modelDecision.reminderProposal?.commitmentId) {
    ensureVisibleCommitment(modelDecision.reminderProposal.commitmentId, 'reminder commitment');
  }

  const memoryCandidates = modelDecision.memoryCandidates.map((candidate) => {
    for (const recordId of candidate.evidenceIds) {
      ensureVisible(recordId, 'memory evidence');
    }
    const promotion = evaluateMemoryPromotion(candidate);
    return {
      id: randomUUID(),
      ownerId: input.context.request.ownerId,
      kind: promotion.effectiveKind,
      normalizedStatement: candidate.normalizedStatement,
      authority: candidate.authority,
      sourceEventId: input.context.request.sourceEventId,
      sourceMessageId: input.context.request.messageId,
      sourceDecisionId: input.decisionId,
      evidenceIds: candidate.evidenceIds,
      confidenceBasisPoints: candidate.confidenceBasisPoints,
      sensitivity: candidate.sensitivity,
      validFrom: candidate.validFrom,
      validTo: candidate.validTo,
      reviewAt: candidate.reviewAt,
      requiresOwnerConfirmation:
        promotion.requiresOwnerConfirmation || candidate.kind === 'constitution_candidate',
      state: 'pending_review' as const,
      relatedEntityIds: candidate.relatedEntityIds,
      createdAt: input.now,
      updatedAt: input.now,
    } satisfies MemoryCandidate;
  });

  let planProposal: PlanProposal | null = null;
  if (modelDecision.planProposal) {
    const proposal = modelDecision.planProposal;
    if (proposal.operations.length + proposal.newFlexibleBlocks.length > 80) {
      throw new ModelDecisionValidationError(
        'The combined planning delta exceeds the bounded operation limit.',
      );
    }
    const allowedDayPlan = input.allowedDayPlanIds.includes(proposal.dayPlanId);
    const seen = new Set<string>();
    const commitmentSchedules: { blockId: string; commitmentId: string }[] = [];
    const proposedBlocks = proposal.operations.map((operation) => {
      ensureVisibleCommitment(operation.commitmentId, 'plan commitment');
      const commitment = input.canonicalCommitments?.find(
        (item) => item.id === operation.commitmentId,
      );
      if (
        !commitment ||
        !schedulableCommitment(commitment, input.context.request.ownerId) ||
        seen.has(commitment.id) ||
        input.existingPlanBlocks.some((block) => block.commitmentId === commitment.id)
      ) {
        throw new ModelDecisionValidationError(
          'Scheduling requires an available, unscheduled, movable canonical commitment.',
        );
      }
      seen.add(commitment.id);
      const id = randomUUID();
      commitmentSchedules.push({ blockId: id, commitmentId: commitment.id });
      return commitmentPlanBlock({
        id,
        dayPlanId: proposal.dayPlanId,
        commitment,
        startsAt: operation.startsAt,
        endsAt: operation.endsAt,
      });
    });
    const newTitles = new Set<string>();
    for (const block of proposal.newFlexibleBlocks) {
      const key = block.title.trim().toLocaleLowerCase('en-US');
      if (
        !input.authorizedNewFlexibleBlockTitles?.includes(block.title) ||
        newTitles.has(key) ||
        input.existingPlanBlocks.some(
          (existing) => existing.title.trim().toLocaleLowerCase('en-US') === key,
        ) ||
        input.canonicalCommitments?.some(
          (existing) => existing.title.trim().toLocaleLowerCase('en-US') === key,
        )
      ) {
        throw new ModelDecisionValidationError(
          'New flexible creation requires distinct trusted owner authorization; existing state cannot be restated.',
        );
      }
      newTitles.add(key);
      proposedBlocks.push(
        planBlockSchema.parse({
          id: randomUUID(),
          ownerId: input.context.request.ownerId,
          dayPlanId: proposal.dayPlanId,
          commitmentId: null,
          title: block.title,
          role: 'work_block',
          anchorClass: 'flexible',
          priority: 0,
          startAt: block.startsAt,
          endAt: block.endsAt,
          earliestStartAt: null,
          latestFinishAt: null,
          estimatedDurationMinutes: (Date.parse(block.endsAt) - Date.parse(block.startsAt)) / 60000,
          minimumDurationMinutes: null,
          dependencyIds: [],
          completionState: 'planned',
          reasonForPlacement: 'Create explicitly authorized new flexible block.',
          source: 'brain_proposal',
        }),
      );
    }
    const draft: PlanProposal = {
      contractVersion: 'flexible_delta_v2',
      id: randomUUID(),
      ownerId: input.context.request.ownerId,
      dayPlanId: proposal.dayPlanId,
      trigger: proposal.trigger,
      proposedBlocks,
      commitmentSchedules,
      tradeoffs: proposal.tradeoffs,
      valid: false,
      validationErrors: allowedDayPlan
        ? []
        : ['The proposal targets a day plan not available to this request.'],
      createdAt: input.now,
    };
    planProposal = allowedDayPlan ? validatePlanProposal(draft, input.existingPlanBlocks) : draft;
  }

  const reminderIntent = modelDecision.reminderProposal;
  const reminderResolution = reminderIntent
    ? input.ownerReminderSource?.deliveryAvailable
      ? resolveOwnerReminder({
          message: input.ownerReminderSource?.message ?? '',
          requestedAt: input.ownerReminderSource?.requestedAt ?? input.now,
          timezone: input.ownerReminderSource?.timezone ?? null,
        })
      : {
          state: 'clarify' as const,
          question:
            'I could not schedule that reminder because your reminder delivery is not ready.',
        }
    : null;
  const reminderProposal: ReminderProposal | null =
    reminderIntent &&
    reminderResolution?.state === 'resolved' &&
    !modelDecision.clarification?.blocking
      ? {
          id: randomUUID(),
          ownerId: input.context.request.ownerId,
          commitmentId: reminderIntent.commitmentId,
          kind: 'fixed_time',
          title: reminderResolution.title,
          scheduledFor: reminderResolution.scheduledFor,
          critical: false,
          escalationLevel: 0,
          groupedWithReminderIds: [],
          rationale: reminderIntent.rationale,
        }
      : null;

  const decision: BrainDecision = {
    decisionType: reminderResolution?.state === 'clarify' ? 'clarify' : modelDecision.decisionType,
    conversationResponse:
      reminderResolution?.state === 'clarify'
        ? { message: reminderResolution.question, nextAction: null, tone: 'neutral' }
        : modelDecision.conversationResponse,
    reasoningSummary: modelDecision.reasoningSummary,
    evidence,
    clarification:
      reminderResolution?.state === 'clarify'
        ? {
            question: reminderResolution.question,
            reason: 'Reminder subject/time requires canonical owner grounding.',
            blocking: true,
            relatedRecordIds: [],
          }
        : modelDecision.clarification,
    proposedActions: reminderResolution?.state === 'clarify' ? [] : modelDecision.proposedActions,
    memoryCandidates,
    planProposal,
    reminderProposal,
    interventionProposal: modelDecision.interventionProposal,
  };

  return { modelDecision, decision, memoryCandidates, planProposal, reminderProposal };
}
