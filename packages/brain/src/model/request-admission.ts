import { createHash } from 'node:crypto';

import type { OpenAiModelRouteConfiguration } from '@jarvis/config';
import type { ModelAdmissionProfile, ModelRequestAdmission, ModelRun } from '@jarvis/contracts';

import { modelDecisionEnvelopeSchema } from './decision-schema.js';
import type { ModelGatewayRequest } from './gateway.js';

/** One construction path for both counting and inference. No prompt/schema truncation. */
export function assembleResponsesRequest<StructuredOutputFormat>(
  request: ModelGatewayRequest,
  route: OpenAiModelRouteConfiguration,
  structuredOutputFormat: StructuredOutputFormat,
) {
  return {
    model: route.model,
    store: false as const,
    truncation: 'disabled' as const,
    instructions: request.instructions,
    input: request.input,
    max_output_tokens: route.maxOutputTokens,
    reasoning: {
      effort: route.reasoningEffort,
      mode: route.reasoningMode,
      context: route.reasoningContext,
    },
    text: {
      verbosity: route.verbosity,
      // The provider adapters construct this OpenAI-compatible structured-output descriptor.
      // Admission serializes it without importing a provider SDK outside that adapter boundary.
      format: structuredOutputFormat,
    },
  };
}

export type AssembledResponsesRequest = ReturnType<typeof assembleResponsesRequest>;

export function requestHash(body: AssembledResponsesRequest): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function tokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Deliberate upper estimate, not a tokenizer: two tokens per serialized UTF-8 byte plus framing. */
export const offlineAdmissionFormula = Object.freeze({
  version: 'utf8-text-json-v1',
  safetyFactor: 2,
  framingAllowanceTokens: 4096,
});

export function createRequestAdmission(
  body: AssembledResponsesRequest,
  profile: ModelAdmissionProfile,
  context: { readonly dynamicContextBudgetTokens: number; readonly dynamicContextEstimate: number },
  countResponse?: unknown,
): ModelRequestAdmission {
  const serialized = JSON.stringify(body);
  const requestBytes = Buffer.byteLength(serialized, 'utf8');
  // Only the assembled JARVIS text/JSON shape is covered. URLs or attachments in structured
  // multimodal input, tools, implicit prior state and extra provider controls need another profile.
  const allowedKeys = [
    'model',
    'store',
    'truncation',
    'instructions',
    'input',
    'max_output_tokens',
    'reasoning',
    'text',
  ];
  const textOnly =
    Object.keys(body).every((key) => allowedKeys.includes(key)) &&
    typeof body.instructions === 'string' &&
    typeof body.input === 'string' &&
    body.store === false &&
    body.truncation === 'disabled' &&
    Object.keys(body.text).every((key) => ['verbosity', 'format'].includes(key)) &&
    Object.keys(body.reasoning).every((key) => ['effort', 'mode', 'context'].includes(key));
  const native =
    profile.nativeCounter !== 'none' &&
    isRecord(countResponse) &&
    countResponse.object === 'response.input_tokens'
      ? tokenCount(countResponse.input_tokens)
      : null;
  const measured = native !== null && native > 0 ? native : null;
  const safetyMarginTokens =
    measured === null ? offlineAdmissionFormula.framingAllowanceTokens : Math.ceil(measured * 0.1);
  const candidate =
    measured === null
      ? Math.ceil(requestBytes * offlineAdmissionFormula.safetyFactor) + safetyMarginTokens
      : measured + safetyMarginTokens;
  const fullRequestInputTokens = textOnly && Number.isSafeInteger(candidate) ? candidate : null;
  const sharedContext = profile.outputSemantics === 'provider_maximum_shared_context';
  const outputSafetyBoundTokens = sharedContext
    ? profile.maximumOutputTokens
    : profile.outputSemantics === 'total_including_reasoning' &&
        profile.reasoningCountsAgainstControl === true
      ? body.max_output_tokens
      : null;
  const maximumInput =
    profile.contextWindowTokens !== null && profile.contextWindowTokens > body.max_output_tokens
      ? profile.contextWindowTokens - body.max_output_tokens
      : null;
  const inputRate = profile.inputCostPerMillionUsd,
    outputRate = profile.outputCostPerMillionUsd;
  const ratesKnown =
    typeof inputRate === 'number' &&
    Number.isFinite(inputRate) &&
    inputRate >= 0 &&
    typeof outputRate === 'number' &&
    Number.isFinite(outputRate) &&
    outputRate >= 0;
  const cost =
    ratesKnown &&
    fullRequestInputTokens !== null &&
    profile.verificationState === 'verified' &&
    outputSafetyBoundTokens !== null
      ? (fullRequestInputTokens * inputRate + outputSafetyBoundTokens * outputRate) / 1_000_000
      : null;
  const worstCaseCostUsd =
    cost !== null && Number.isFinite(cost)
      ? Math.ceil(cost * 1_000_000_000_000) / 1_000_000_000_000
      : null;
  let errorCategory: string | null = null;
  let reason =
    'The conservative full-request estimate plus output reserve fits the verified model context window. Spend admission remains independently required.';
  if (!textOnly || fullRequestInputTokens === null) {
    errorCategory = 'input_modality_unbounded';
    reason =
      'This request contains unsupported input or provider options whose token cost cannot be safely bounded.';
  } else if (
    profile.modelId !== body.model ||
    profile.reasoningEffort !== body.reasoning.effort ||
    profile.requestedOutputTokens !== body.max_output_tokens ||
    !Number.isFinite(Date.parse(profile.verifiedAt)) ||
    Date.now() - Date.parse(profile.verifiedAt) > 86400000 ||
    Date.parse(profile.verifiedAt) > Date.now() + 60000
  ) {
    errorCategory = 'admission_profile_mismatch';
    reason = 'The verified admission profile is stale or does not match this model request.';
  } else if (profile.verificationState === 'blocked' || outputSafetyBoundTokens === null) {
    errorCategory = 'provider_output_limit_unverified';
    reason = profile.verificationReason;
  } else if (profile.verificationState !== 'verified') {
    errorCategory = 'admission_profile_unverified';
    reason = profile.verificationReason;
  } else if (maximumInput === null || profile.maximumOutputTokens === null) {
    errorCategory = 'model_context_unavailable';
    reason = 'Verified model context or output capacity is unavailable.';
  } else if (
    fullRequestInputTokens > maximumInput ||
    body.max_output_tokens > profile.maximumOutputTokens
  ) {
    errorCategory = 'model_context_window_exceeded';
    reason =
      'The conservative complete input plus output reserve exceeds the verified model context window or output capacity.';
  } else if (worstCaseCostUsd === null) {
    errorCategory = 'request_cost_bound_unavailable';
    reason = 'Verified pricing is unavailable; a conservative request cost cannot be established.';
  }
  // Snapshot/freeze the profile too: callers cannot change price/window provenance after admission.
  const snapshot = JSON.parse(JSON.stringify(profile)) as ModelAdmissionProfile;
  Object.freeze(snapshot.providerRoute);
  Object.freeze(snapshot.sources);
  Object.freeze(snapshot);
  return Object.freeze({
    requestHash: requestHash(body),
    modelId: body.model,
    providerScope: profile.providerRoute.join(','),
    reasoningEffort: body.reasoning.effort,
    measurementMethod: !textOnly
      ? 'unavailable'
      : measured === null
        ? 'conservative_utf8'
        : 'provider_count',
    estimationVersion:
      measured === null ? offlineAdmissionFormula.version : 'verified-native-plus-10pct-v1',
    safetyFactor: measured === null ? offlineAdmissionFormula.safetyFactor : 1.1,
    framingAllowanceTokens: measured === null ? offlineAdmissionFormula.framingAllowanceTokens : 0,
    dynamicContextBudgetTokens: context.dynamicContextBudgetTokens,
    dynamicContextEstimate: context.dynamicContextEstimate,
    contextWindowTokens: profile.contextWindowTokens,
    profile: snapshot,
    measuredInputTokens: measured,
    safetyMarginTokens,
    fullRequestInputTokens,
    maxInputTokens: maximumInput,
    maxOutputTokens: body.max_output_tokens,
    outputSafetyBoundTokens,
    worstCaseCostUsd,
    outputLimitSemantics: profile.outputSemantics,
    allowed: errorCategory === null,
    reason,
    errorCategory,
    requestBytes,
    instructionsBytes: Buffer.byteLength(body.instructions),
    inputBytes: Buffer.byteLength(
      typeof body.input === 'string' ? body.input : JSON.stringify(body.input),
    ),
    schemaBytes: Buffer.byteLength(JSON.stringify(body.text.format)),
    measuredAt: new Date().toISOString(),
  });
}

/** Never label provider-total minus reasoning as visible: formatting may also be billed. */
export function responseUsageAccounting(
  response: unknown,
  admission: ModelRequestAdmission,
): {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cachedInputTokens: number | null;
  usageAccounting: NonNullable<ModelRun['usageAccounting']>;
  outputAudit?: ModelRun['outputAudit'];
} {
  const usage = isRecord(response) && isRecord(response.usage) ? response.usage : {};
  const inputTokens = tokenCount(usage.input_tokens);
  const outputTokens = tokenCount(usage.output_tokens);
  const reasoningTokens = isRecord(usage.output_tokens_details)
    ? tokenCount(usage.output_tokens_details.reasoning_tokens)
    : null;
  const cachedInputTokens = isRecord(usage.input_tokens_details)
    ? tokenCount(usage.input_tokens_details.cached_tokens)
    : null;
  const usageValid =
    inputTokens !== null &&
    outputTokens !== null &&
    reasoningTokens !== null &&
    reasoningTokens <= outputTokens &&
    (cachedInputTokens === null || cachedInputTokens <= inputTokens);
  const inputBoundExceeded =
    inputTokens !== null &&
    (admission.fullRequestInputTokens === null ||
      inputTokens > admission.fullRequestInputTokens ||
      (admission.maxInputTokens !== null && inputTokens > admission.maxInputTokens));
  const outputBoundExceeded =
    outputTokens !== null &&
    outputTokens > (admission.outputSafetyBoundTokens ?? admission.maxOutputTokens);
  const contextBoundExceeded =
    inputTokens !== null &&
    outputTokens !== null &&
    admission.contextWindowTokens != null &&
    inputTokens + outputTokens > admission.contextWindowTokens;
  const requestedOutputControlExceeded =
    outputTokens !== null && outputTokens > admission.maxOutputTokens;
  const profileAfterRun = admission.profile
    ? {
        ...admission.profile,
        verificationState: (!usageValid ||
        inputBoundExceeded ||
        outputBoundExceeded ||
        contextBoundExceeded
          ? 'blocked'
          : admission.profile.verificationState) as ModelAdmissionProfile['verificationState'],
        lastObservedUsage: {
          inputTokens,
          outputTokens,
          reasoningTokens,
          requestedControlExceeded: requestedOutputControlExceeded,
          safetyBoundExceeded: inputBoundExceeded || outputBoundExceeded || contextBoundExceeded,
          observedAt: new Date().toISOString(),
        },
      }
    : undefined;
  return {
    inputTokens,
    outputTokens,
    reasoningTokens,
    cachedInputTokens,
    ...(response === undefined ? {} : { outputAudit: auditDecisionResponse(response) }),
    usageAccounting: {
      providerTotalOutputTokens: outputTokens,
      nonReasoningOutputTokens:
        outputTokens !== null && reasoningTokens !== null && reasoningTokens <= outputTokens
          ? outputTokens - reasoningTokens
          : null,
      visibleOutputTokens: null,
      reasoningTokens,
      visibleMeasurement: 'unreported',
      usageValid,
      inputBoundExceeded,
      outputBoundExceeded,
      contextBoundExceeded,
      requestedOutputControlExceeded,
      ...(profileAfterRun ? { profileAfterRun } : {}),
    },
  };
}

/** Parse after recording usage so malformed/truncated JSON cannot discard billed tokens. */
function decisionResponseText(response: unknown): string {
  const output = isRecord(response) && Array.isArray(response.output) ? response.output : [];
  return output
    .flatMap((item: unknown) =>
      isRecord(item) && item.type === 'message' && Array.isArray(item.content) ? item.content : [],
    )
    .filter(
      (item: unknown): item is Record<string, unknown> =>
        isRecord(item) && item.type === 'output_text' && typeof item.text === 'string',
    )
    .map((item: Record<string, unknown>) => item.text as string)
    .join('');
}

function decisionResponseValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Restricted audit evidence only. It is never parsed into canonical mutations. */
export function auditDecisionResponse(response: unknown): NonNullable<ModelRun['outputAudit']> {
  const text = decisionResponseText(response);
  const value = decisionResponseValue(text);
  const result = modelDecisionEnvelopeSchema.safeParse(value);
  const planJson =
    isRecord(value) && value.planProposal != null ? JSON.stringify(value.planProposal) : null;
  return {
    contractVersion: 'flexible_delta_v2',
    responseTextSha256: createHash('sha256').update(text).digest('hex'),
    schemaValid: result.success,
    issuePaths: result.success
      ? []
      : result.error.issues
          .slice(0, 32)
          .map((issue) => `${issue.code}:${issue.path.map(String).join('.')}`),
    planJson: planJson?.slice(0, 65536) ?? null,
    planJsonTruncated: planJson !== null && planJson.length > 65536,
  };
}

export function parseDecisionResponse(response: unknown) {
  const text = decisionResponseText(response);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = undefined;
  }
  return modelDecisionEnvelopeSchema.safeParse(parsed);
}
