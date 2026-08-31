import type { ModelRuntimeConfiguration } from '@jarvis/config';

import type { ModelGateway } from './gateway.js';
import { NotConfiguredModelGateway } from './not-configured-gateway.js';
import { OpenAiResponsesModelGateway } from './openai-responses-gateway.js';
import { VercelAiGatewayModelGateway } from './vercel-ai-gateway.js';

/** Creates an optional provider adapter without making CI or local development require a key. */
export function createConfiguredModelGateway(
  configuration: ModelRuntimeConfiguration,
): ModelGateway {
  if (configuration.provider === 'vercel-ai-gateway') {
    return configuration.oidcToken
      ? new VercelAiGatewayModelGateway(configuration)
      : new NotConfiguredModelGateway();
  }
  return configuration.apiKey
    ? new OpenAiResponsesModelGateway(configuration)
    : new NotConfiguredModelGateway();
}
