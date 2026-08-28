import type { ActionRiskClass, PolicyEvaluation, ProposedAction } from '@jarvis/contracts';

export const policyVersion = 'phase-1.0';

export interface PolicyEvaluationContext {
  readonly ownerAuthorized: boolean;
  readonly killSwitchActive?: boolean;
  readonly controlledWriteMode?: 'deny' | 'require_approval';
}

interface ActionRule {
  readonly id: string;
  readonly actionType: string;
  readonly riskClass: ActionRiskClass;
}

const actionRules: readonly ActionRule[] = [
  { id: 'read.internal', actionType: 'internal.read', riskClass: 'READ' },
  {
    id: 'internal.commitment.create',
    actionType: 'internal.commitment.create',
    riskClass: 'LOW_RISK_INTERNAL',
  },
  {
    id: 'internal.commitment.update',
    actionType: 'internal.commitment.update',
    riskClass: 'LOW_RISK_INTERNAL',
  },
  {
    id: 'internal.reminder.create',
    actionType: 'internal.reminder.create',
    riskClass: 'LOW_RISK_INTERNAL',
  },
  {
    id: 'internal.plan.update',
    actionType: 'internal.plan.update',
    riskClass: 'LOW_RISK_INTERNAL',
  },
  { id: 'calendar.event.write', actionType: 'calendar.event.write', riskClass: 'CONTROLLED_WRITE' },
  { id: 'email.archive', actionType: 'email.archive', riskClass: 'CONTROLLED_WRITE' },
  { id: 'external.message.send', actionType: 'external.message.send', riskClass: 'HIGH_IMPACT' },
  { id: 'email.send', actionType: 'email.send', riskClass: 'HIGH_IMPACT' },
  { id: 'appointment.cancel', actionType: 'appointment.cancel', riskClass: 'HIGH_IMPACT' },
  { id: 'important.data.delete', actionType: 'important.data.delete', riskClass: 'HIGH_IMPACT' },
];

function result(input: Omit<PolicyEvaluation, 'policyVersion'>): PolicyEvaluation {
  return {
    ...input,
    policyVersion,
  };
}

export function evaluatePolicy(
  action: ProposedAction,
  context: PolicyEvaluationContext,
): PolicyEvaluation {
  if (!context.ownerAuthorized) {
    return result({
      allowed: false,
      requiresApproval: false,
      denied: true,
      reason: 'A verified owner-scoped principal is required.',
      matchedRules: ['owner.authorization.required'],
    });
  }

  if (context.killSwitchActive) {
    return result({
      allowed: false,
      requiresApproval: false,
      denied: true,
      reason: 'The owner kill switch is active.',
      matchedRules: ['owner.kill-switch'],
    });
  }

  if (action.actionType.startsWith('finance.')) {
    return result({
      allowed: false,
      requiresApproval: false,
      denied: true,
      reason: 'Finance writes are prohibited.',
      matchedRules: ['finance.write.prohibited'],
    });
  }

  const rule = actionRules.find((candidate) => candidate.actionType === action.actionType);
  if (!rule) {
    return result({
      allowed: false,
      requiresApproval: false,
      denied: true,
      reason: 'No policy rule recognizes this action type.',
      matchedRules: ['action.unknown.denied'],
    });
  }

  if (action.riskClass !== rule.riskClass) {
    return result({
      allowed: false,
      requiresApproval: false,
      denied: true,
      reason: 'The proposed risk class does not match the registered action type.',
      matchedRules: [rule.id, 'risk-class.mismatch'],
    });
  }

  if (rule.riskClass === 'HIGH_IMPACT') {
    return result({
      allowed: false,
      requiresApproval: true,
      denied: false,
      reason: 'High-impact actions always require explicit approval.',
      matchedRules: [rule.id, 'high-impact.approval.required'],
    });
  }

  if (rule.riskClass === 'CONTROLLED_WRITE') {
    return result({
      allowed: false,
      requiresApproval: context.controlledWriteMode !== 'deny',
      denied: context.controlledWriteMode === 'deny',
      reason:
        context.controlledWriteMode === 'deny'
          ? 'Controlled writes are disabled until a connector-specific rule is approved.'
          : 'Controlled writes require explicit approval.',
      matchedRules: [rule.id, 'controlled-write.owner-policy'],
    });
  }

  return result({
    allowed: true,
    requiresApproval: false,
    denied: false,
    reason: 'The action is within the verified owner-scoped internal policy.',
    matchedRules: [rule.id, `${rule.riskClass.toLowerCase()}.allowed`],
  });
}
