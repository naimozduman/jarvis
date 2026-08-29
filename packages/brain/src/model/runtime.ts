import type { OpenAiRuntimeConfiguration } from '@jarvis/config';

import type { ModelGateway } from './gateway.js';
import { NotConfiguredModelGateway } from './not-configured-gateway.js';
import { OpenAiResponsesModelGateway } from './openai-responses-gateway.js';

/** Creates an optional provider adapter without making CI or local development require a key. */
export function createConfiguredModelGateway(
  configuration: OpenAiRuntimeConfiguration,
): ModelGateway {
  return configuration.apiKey
    ? new OpenAiResponsesModelGateway(configuration)
    : new NotConfiguredModelGateway();
}
