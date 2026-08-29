import { classifyEvolutionError, type EvolutionErrorCategory } from './errors.js';

/** Explicit adapter component for worker-safe disposition decisions and telemetry categories. */
export class EvolutionErrorClassifier {
  public classify(error: unknown): {
    readonly category: EvolutionErrorCategory;
    readonly retryable: boolean;
    readonly requiresReconciliation: boolean;
  } {
    const classified = classifyEvolutionError(error);
    return {
      category: classified.category,
      retryable: classified.retryable,
      requiresReconciliation: classified.requiresReconciliation,
    };
  }
}
