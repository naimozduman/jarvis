import { randomUUID } from 'node:crypto';

import type {
  BrainContext,
  BrainDecision,
  BrainEvidence,
  ContextRecord,
  MemoryCandidate,
  PlanBlock,
  PlanProposal,
  ReminderProposal,
} from '@jarvis/contracts';

import { evaluateMemoryPromotion } from '../memory/promotion-policy.js';
import {
  modelDecisionEnvelopeSchema,
  type ModelDecisionEnvelope,
} from '../model/decision-schema.js';
import { validatePlanProposal } from '../planning/constraint-validator.js';

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
  readonly allowedDayPlanIds: readonly string[];
  readonly isSupportedIntervention: (interventionId: string) => boolean;
}): MaterializedModelDecision {
  const parsed = modelDecisionEnvelopeSchema.safeParse(input.rawDecision);
  if (!parsed.success) {
    throw new ModelDecisionValidationError(
      'The model response did not satisfy the strict brain decision schema.',
    );
  }
  const modelDecision = parsed.data;
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
    if (record.recordType !== 'commitment') {
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
    if (action.actionType === 'internal.commitment.update' && action.targetRecordId) {
      ensureVisibleCommitment(action.targetRecordId, 'commitment action target');
    }
    if (action.completionEvidenceId) {
      ensureVisible(action.completionEvidenceId, 'completion evidence');
    }
    for (const recordId of action.evidenceIds) {
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
    const allowedDayPlan = input.allowedDayPlanIds.includes(proposal.dayPlanId);
    const existingBlocksById = new Map(input.existingPlanBlocks.map((block) => [block.id, block]));
    for (const block of proposal.proposedBlocks) {
      if (block.commitmentId) {
        ensureVisibleCommitment(block.commitmentId, 'plan commitment');
      }
      if (block.existingBlockId) {
        const existing = existingBlocksById.get(block.existingBlockId);
        if (!existing || existing.dayPlanId !== proposal.dayPlanId) {
          throw new ModelDecisionValidationError(
            'The model attempted to update a plan block unavailable to this day plan.',
          );
        }
      }
    }
    const draft: PlanProposal = {
      id: randomUUID(),
      ownerId: input.context.request.ownerId,
      dayPlanId: proposal.dayPlanId,
      trigger: proposal.trigger,
      proposedBlocks: proposal.proposedBlocks.map((block) => ({
        id: block.existingBlockId ?? randomUUID(),
        ownerId: input.context.request.ownerId,
        dayPlanId: proposal.dayPlanId,
        commitmentId: block.commitmentId,
        title: block.title,
        role: block.role,
        anchorClass: block.anchorClass,
        priority: block.priority,
        startAt: block.startAt,
        endAt: block.endAt,
        earliestStartAt: block.earliestStartAt,
        latestFinishAt: block.latestFinishAt,
        estimatedDurationMinutes: block.estimatedDurationMinutes,
        minimumDurationMinutes: block.minimumDurationMinutes,
        dependencyIds: block.dependencyIds,
        completionState: 'planned',
        reasonForPlacement: block.reasonForPlacement,
        source: 'brain_proposal',
      })),
      tradeoffs: proposal.tradeoffs,
      valid: false,
      validationErrors: allowedDayPlan
        ? []
        : ['The proposal targets a day plan not available to this request.'],
      createdAt: input.now,
    };
    planProposal = allowedDayPlan ? validatePlanProposal(draft, input.existingPlanBlocks) : draft;
  }

  const reminderProposal: ReminderProposal | null = modelDecision.reminderProposal
    ? {
        id: randomUUID(),
        ownerId: input.context.request.ownerId,
        commitmentId: modelDecision.reminderProposal.commitmentId,
        kind: modelDecision.reminderProposal.kind,
        title: modelDecision.reminderProposal.title,
        scheduledFor: modelDecision.reminderProposal.scheduledFor,
        critical: modelDecision.reminderProposal.critical,
        escalationLevel: modelDecision.reminderProposal.escalationLevel,
        groupedWithReminderIds: modelDecision.reminderProposal.groupedWithReminderIds,
        rationale: modelDecision.reminderProposal.rationale,
      }
    : null;

  const decision: BrainDecision = {
    decisionType: modelDecision.decisionType,
    conversationResponse: modelDecision.conversationResponse,
    reasoningSummary: modelDecision.reasoningSummary,
    evidence,
    clarification: modelDecision.clarification,
    proposedActions: modelDecision.proposedActions,
    memoryCandidates,
    planProposal,
    reminderProposal,
    interventionProposal: modelDecision.interventionProposal,
  };

  return { modelDecision, decision, memoryCandidates, planProposal, reminderProposal };
}
