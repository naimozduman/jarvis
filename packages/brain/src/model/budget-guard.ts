import type { BrainRuntimeConfiguration, OpenAiRuntimeConfiguration } from '@jarvis/config';
import type { ModelRoute } from '@jarvis/contracts';

export interface ModelBudgetUsage {
  readonly callsAlreadyMade: number;
  readonly dailySpendEstimateUsd: number;
  readonly dailyDeepCallsUsed: number;
  readonly approximatePromptTokens: number;
}

export interface ModelBudgetDecision {
  readonly allowed: boolean;
  readonly reason: string;
  readonly worstCaseRequestCostUsd: number;
}

/** Conservative preflight budget guard; a model call is never used to answer a budget question. */
export class ModelBudgetGuard {
  public constructor(
    private readonly models: OpenAiRuntimeConfiguration,
    private readonly limits: BrainRuntimeConfiguration,
  ) {}

  public evaluate(route: ModelRoute, usage: ModelBudgetUsage): ModelBudgetDecision {
    const model = this.models[route];
    const worstCaseRequestCostUsd =
      (usage.approximatePromptTokens * model.rateCard.inputCostPerMillionUsd +
        model.maxOutputTokens * model.rateCard.outputCostPerMillionUsd) /
      1_000_000;
    if (usage.callsAlreadyMade >= this.limits.maxModelCallsPerCycle) {
      return {
        allowed: false,
        reason: 'The maximum model calls for this reasoning cycle is reached.',
        worstCaseRequestCostUsd,
      };
    }
    if (route === 'deep' && usage.dailyDeepCallsUsed >= this.limits.dailyDeepCallLimit) {
      return {
        allowed: false,
        reason: 'The daily deep-model call limit is reached.',
        worstCaseRequestCostUsd,
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
      };
    }
    return {
      allowed: true,
      reason: 'Within configured model-call, deep-route, and cost limits.',
      worstCaseRequestCostUsd,
    };
  }
}
