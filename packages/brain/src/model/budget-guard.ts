import type { BrainRuntimeConfiguration, ModelRuntimeConfiguration } from '@jarvis/config';
import type { ModelRoute } from '@jarvis/contracts';

/**
 * Canonical accounting for completed JARVIS Gateway calls after the operator's Vercel dashboard
 * snapshot. `hasUnknownCompletedCost` is a circuit breaker: it prevents a second request when the
 * provider did not return an exact, safely parseable cost receipt for an earlier one.
 */
export interface ZeroCostCreditAccounting {
  readonly reportedCostUsdSinceSnapshot: number;
  readonly hasUnknownCompletedCost: boolean;
}

/** Canonical Neon-backed port; implementations must not use process memory as a credit ledger. */
export interface ZeroCostCreditAccountingSource {
  loadZeroCostCreditAccounting(input: {
    readonly ownerId: string;
    readonly afterExclusive: string;
  }): Promise<ZeroCostCreditAccounting>;
}

export interface ModelBudgetUsage {
  readonly callsAlreadyMade: number;
  readonly dailySpendEstimateUsd: number;
  readonly dailyDeepCallsUsed: number;
  readonly approximatePromptTokens: number;
  readonly zeroCostCreditAccounting?: ZeroCostCreditAccounting;
}

export interface ModelBudgetDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly worstCaseRequestCostUsd: number | null;
  /** A Free Tier/refusal condition is an explicit provider-unavailable result, never a fallback. */
  readonly failureStatus: 'failed' | 'provider_unavailable' | null;
}

export interface ModelBudgetGuardOptions {
  readonly now?: () => Date;
}

function routeWorstCaseRequestCostUsd(
  configuration: ModelRuntimeConfiguration,
  route: ModelRoute,
  approximatePromptTokens: number,
): number | null {
  const model = configuration[route];
  const { inputCostPerMillionUsd, outputCostPerMillionUsd } = model.rateCard;
  if (
    inputCostPerMillionUsd === null ||
    outputCostPerMillionUsd === null ||
    !Number.isFinite(inputCostPerMillionUsd) ||
    !Number.isFinite(outputCostPerMillionUsd)
  ) {
    return null;
  }
  return (
    (Math.max(0, approximatePromptTokens) * inputCostPerMillionUsd +
      model.maxOutputTokens * outputCostPerMillionUsd) /
    1_000_000
  );
}

function isCurrentUtcMonth(value: string | undefined, now: Date): boolean {
  if (!value) return false;
  const observedAt = new Date(value);
  if (Number.isNaN(observedAt.getTime()) || observedAt.getTime() > now.getTime()) {
    return false;
  }
  return (
    observedAt.getUTCFullYear() === now.getUTCFullYear() &&
    observedAt.getUTCMonth() === now.getUTCMonth()
  );
}

/** Conservative preflight guard; a model call is never used to answer a budget or quota question. */
export class ModelBudgetGuard {
  private readonly now: () => Date;

  public constructor(
    private readonly models: ModelRuntimeConfiguration,
    private readonly limits: BrainRuntimeConfiguration,
    options: ModelBudgetGuardOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  public requiresZeroCostCreditAccounting(): boolean {
    return this.models.zeroCostMode;
  }

  public zeroCostCreditAccountingSnapshotAsOf(): string | undefined {
    return this.models.freeTierCreditGuard.reportedMonthlyUsageAsOf;
  }

  public evaluate(route: ModelRoute, usage: ModelBudgetUsage): ModelBudgetDecision {
    const worstCaseRequestCostUsd = routeWorstCaseRequestCostUsd(
      this.models,
      route,
      usage.approximatePromptTokens,
    );
    if (usage.callsAlreadyMade >= this.limits.maxModelCallsPerCycle) {
      return {
        allowed: false,
        reason: 'The maximum model calls for this reasoning cycle is reached.',
        worstCaseRequestCostUsd,
        failureStatus: 'failed',
      };
    }
    if (route === 'deep' && usage.dailyDeepCallsUsed >= this.limits.dailyDeepCallLimit) {
      return {
        allowed: false,
        reason: 'The daily deep-model call limit is reached.',
        worstCaseRequestCostUsd,
        failureStatus: 'failed',
      };
    }
    if (worstCaseRequestCostUsd === null) {
      return {
        allowed: false,
        reason: this.models.zeroCostMode
          ? 'The Free Tier model rate accounting is unavailable, so JARVIS will not make a request.'
          : 'The configured model rate accounting is unavailable, so JARVIS will not make a request.',
        worstCaseRequestCostUsd,
        failureStatus: this.models.zeroCostMode ? 'provider_unavailable' : 'failed',
      };
    }
    if (
      usage.dailySpendEstimateUsd + worstCaseRequestCostUsd >
      this.limits.dailyModelSpendLimitUsd
    ) {
      return {
        allowed: false,
        reason: 'The conservative daily model-spend limit would be exceeded.',
        worstCaseRequestCostUsd,
        failureStatus: 'failed',
      };
    }
    if (!this.models.zeroCostMode) {
      return {
        allowed: true,
        reason: 'Within configured model-call, deep-route, and cost limits.',
        worstCaseRequestCostUsd,
        failureStatus: null,
      };
    }

    const guard = this.models.freeTierCreditGuard;
    const accounting = usage.zeroCostCreditAccounting;
    if (
      guard.reportedMonthlyUsageUsd === undefined ||
      !isCurrentUtcMonth(guard.reportedMonthlyUsageAsOf, this.now()) ||
      !accounting
    ) {
      return {
        allowed: false,
        reason:
          'Current Free Tier credit accounting is unavailable, so JARVIS will not make a request.',
        worstCaseRequestCostUsd,
        failureStatus: 'provider_unavailable',
      };
    }
    if (accounting.hasUnknownCompletedCost) {
      return {
        allowed: false,
        reason:
          'A prior Free Tier request has no safely reported cost, so JARVIS will not make another request.',
        worstCaseRequestCostUsd,
        failureStatus: 'provider_unavailable',
      };
    }
    const currentReportedCostUsd =
      guard.reportedMonthlyUsageUsd + accounting.reportedCostUsdSinceSnapshot;
    if (currentReportedCostUsd + worstCaseRequestCostUsd > guard.monthlyCreditGuardUsd) {
      return {
        allowed: false,
        reason:
          'The configured Free Tier credit safety guard would be exceeded, so JARVIS will not make a request.',
        worstCaseRequestCostUsd,
        failureStatus: 'provider_unavailable',
      };
    }
    return {
      allowed: true,
      reason: 'Within the configured Free Tier credit safety guard.',
      worstCaseRequestCostUsd,
      failureStatus: null,
    };
  }
}
