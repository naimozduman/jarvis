import type { ContextRecord } from '@jarvis/contracts';

import { promptModulesForPurpose } from './registry.js';
import type { AssembledPrompt, PromptAssemblyInput, PromptModulePurpose } from './types.js';

const alwaysIncluded: readonly PromptModulePurpose[] = [
  'core_identity',
  'constitution',
  'tool_actions',
  'uncertainty',
  'security',
  'privacy',
  'communication_style',
];

const purposeModules: Readonly<Record<PromptAssemblyInput['purpose'], readonly PromptModulePurpose[]>> = {
  conversation: ['memory', 'accountability', 'planning', 'reminders'],
  classification: ['memory'],
  memory_extraction: ['memory'],
  accountability: ['accountability', 'behavioral_intervention', 'reminders'],
  replan: ['planning', 'replanning', 'accountability'],
  reminder: ['reminders', 'accountability'],
  weekly_review: ['accountability', 'planning', 'replanning', 'behavioral_intervention', 'reminders'],
  clarification: ['memory'],
};

function modelVisibleRecord(record: ContextRecord): Record<string, unknown> {
  return {
    recordId: record.recordId,
    recordType: record.recordType,
    source: record.source,
    informationState: record.informationState,
    confidenceBasisPoints: record.confidenceBasisPoints,
    sensitivity: record.sensitivity,
    observedAt: record.observedAt,
    content: record.content,
    entityReferences: record.entityReferences,
  };
}

function stableModuleFingerprint(moduleIds: readonly string[]): string {
  let hash = 2_166_136_261;
  for (const character of moduleIds.join('|')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Composes a bounded one-turn model input; callers persist the version, never this full body. */
export class PromptAssembler {
  public assemble(input: PromptAssemblyInput): AssembledPrompt {
    const requestedPurposes = [...alwaysIncluded, ...purposeModules[input.purpose]];
    const modules = promptModulesForPurpose(requestedPurposes);
    const moduleIds = modules.map((item) => `${item.id}@${item.version}`);
    const version = `phase2-${moduleIds.length}-${stableModuleFingerprint(moduleIds)}`;
    const instructions = modules.map((item) => `[${item.id}@${item.version}]\n${item.content}`).join('\n\n');
    const body = {
      request: { id: input.context.request.id, purpose: input.context.request.purpose, timestamp: input.context.now },
      ownerMessage: input.ownerMessage,
      context: input.context.records.map(modelVisibleRecord),
      contextManifest: {
        id: input.context.manifest.id,
        version: input.context.manifest.contextVersion,
        includedRecordIds: input.context.manifest.selectedRecords.map((record) => record.recordId),
        excludedRecordCount: input.context.manifest.excludedRecordCount,
      },
      availableData: input.context.availableData,
      hardOverrideIds: input.context.hardOverrideIds,
    };
    return { version, moduleIds, instructions, input: JSON.stringify(body) };
  }
}
