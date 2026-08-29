import type { BrainContext, BrainRequestPurpose } from '@jarvis/contracts';

export type PromptModulePurpose =
  | 'core_identity'
  | 'constitution'
  | 'memory'
  | 'accountability'
  | 'planning'
  | 'replanning'
  | 'behavioral_intervention'
  | 'reminders'
  | 'communication_style'
  | 'tool_actions'
  | 'uncertainty'
  | 'security'
  | 'privacy';

export interface PromptModule {
  readonly id: string;
  readonly version: string;
  readonly purpose: PromptModulePurpose;
  readonly content: string;
  readonly updatedAt: string;
}

export interface PromptAssemblyInput {
  readonly purpose: BrainRequestPurpose;
  readonly context: BrainContext;
  readonly ownerMessage: string | null;
}

export interface AssembledPrompt {
  /** Static module version metadata only; full prompt content is intentionally not telemetry. */
  readonly version: string;
  readonly moduleIds: readonly string[];
  readonly instructions: string;
  /** Deliberately bounded, context-assembled JSON supplied as a one-turn stateless input. */
  readonly input: string;
}
