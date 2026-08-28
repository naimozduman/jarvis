import type { ApprovalRequest, ProposedAction } from '@jarvis/contracts';

import { createStateHash } from './idempotency.js';

export class ApprovalEnforcementError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ApprovalEnforcementError';
  }
}

export function createActionSnapshotHash(action: ProposedAction): string {
  return createStateHash({
    actionType: action.actionType,
    id: action.id,
    ownerId: action.ownerId,
    payload: action.payload,
    riskClass: action.riskClass,
  });
}

export function assertApprovalCanBeConsumed(
  approval: ApprovalRequest,
  action: ProposedAction,
  now: Date,
): void {
  if (approval.ownerId !== action.ownerId || approval.proposedActionId !== action.id) {
    throw new ApprovalEnforcementError('The approval does not belong to this action and owner.');
  }

  if (approval.state !== 'approved') {
    throw new ApprovalEnforcementError('The approval is not in an approved state.');
  }

  if (Date.parse(approval.expiresAt) <= now.getTime()) {
    throw new ApprovalEnforcementError('The approval has expired.');
  }

  if (approval.actionSnapshotHash !== createActionSnapshotHash(action)) {
    throw new ApprovalEnforcementError('The action changed after approval was granted.');
  }
}

/** Phase 1 deliberately has no high-impact executor, even after an approval is stored. */
export function assertPhaseOneActionExecutable(action: ProposedAction): void {
  if (action.riskClass === 'HIGH_IMPACT') {
    throw new ApprovalEnforcementError(
      'High-impact execution is not implemented in Phase 1; approval is recorded only.',
    );
  }
}
