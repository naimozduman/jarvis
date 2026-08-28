import { describe, expect, it } from 'vitest';

import type { ApprovalRequest, ProposedAction } from '@jarvis/contracts';
import {
  ApprovalEnforcementError,
  assertApprovalCanBeConsumed,
  assertPhaseOneActionExecutable,
  createActionSnapshotHash,
  evaluatePolicy,
} from '@jarvis/security';

const ownerId = '00000000-0000-4000-8000-000000000001';

function action(actionType: string, riskClass: ProposedAction['riskClass']): ProposedAction {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    ownerId,
    actionType,
    payload: { reference: 'test' },
    riskClass,
    idempotencyKey: 'action:1234567890abcdef',
    correlationId: '00000000-0000-4000-8000-000000000003',
    state: 'proposed',
    expiresAt: null,
  };
}

describe('Phase 1 policy engine', () => {
  it('allows owner-scoped reads and low-risk internal state changes', () => {
    expect(
      evaluatePolicy(action('internal.read', 'READ'), { ownerAuthorized: true }),
    ).toMatchObject({
      allowed: true,
      requiresApproval: false,
      denied: false,
    });
    expect(
      evaluatePolicy(action('internal.reminder.create', 'LOW_RISK_INTERNAL'), {
        ownerAuthorized: true,
      }),
    ).toMatchObject({ allowed: true, denied: false });
  });

  it('requires approval for controlled writes and all high-impact actions', () => {
    expect(
      evaluatePolicy(action('calendar.event.write', 'CONTROLLED_WRITE'), {
        ownerAuthorized: true,
      }),
    ).toMatchObject({ allowed: false, requiresApproval: true, denied: false });
    expect(
      evaluatePolicy(action('external.message.send', 'HIGH_IMPACT'), {
        ownerAuthorized: true,
      }),
    ).toMatchObject({ allowed: false, requiresApproval: true, denied: false });
  });

  it('denies finance writes, unregistered actions, risk mismatches, and owner failures', () => {
    expect(
      evaluatePolicy(action('finance.transfer', 'HIGH_IMPACT'), { ownerAuthorized: true }),
    ).toMatchObject({
      denied: true,
    });
    expect(
      evaluatePolicy(action('unknown.action', 'READ'), { ownerAuthorized: true }),
    ).toMatchObject({
      denied: true,
    });
    expect(
      evaluatePolicy(action('internal.read', 'LOW_RISK_INTERNAL'), { ownerAuthorized: true }),
    ).toMatchObject({ denied: true });
    expect(
      evaluatePolicy(action('internal.read', 'READ'), { ownerAuthorized: false }),
    ).toMatchObject({
      denied: true,
    });
  });
});

describe('approval enforcement', () => {
  it('requires matching, unexpired, owner-scoped approval and rejects Phase 1 high-impact execution', () => {
    const highImpact = action('external.message.send', 'HIGH_IMPACT');
    const approval: ApprovalRequest = {
      id: '00000000-0000-4000-8000-000000000004',
      ownerId,
      proposedActionId: highImpact.id,
      riskClass: 'HIGH_IMPACT',
      actionSnapshotHash: createActionSnapshotHash(highImpact),
      state: 'approved',
      requestedAt: '2026-08-28T12:00:00.000Z',
      expiresAt: '2026-08-29T12:00:00.000Z',
      resolvedAt: '2026-08-28T12:05:00.000Z',
      actorId: ownerId,
      result: {},
    };

    expect(() =>
      assertApprovalCanBeConsumed(approval, highImpact, new Date('2026-08-28T13:00:00Z')),
    ).not.toThrow();
    expect(() => assertPhaseOneActionExecutable(highImpact)).toThrow(ApprovalEnforcementError);
    expect(() =>
      assertApprovalCanBeConsumed(
        approval,
        { ...highImpact, payload: { reference: 'changed' } },
        new Date('2026-08-28T13:00:00Z'),
      ),
    ).toThrow(ApprovalEnforcementError);
  });
});
