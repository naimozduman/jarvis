import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  createConfiguredModelGateway,
  NotConfiguredModelGateway,
  VercelAiGatewayModelGateway,
} from '@jarvis/brain';
import { loadApiEnvironment } from '@jarvis/config';

import { environmentSourceForVercelInvocation } from '../src/vercel-runtime.js';

describe('Vercel runtime serverless boundary', () => {
  it('reconstructs invocation state from Neon and never composes a local worker, timer, or Evolution client', async () => {
    const source = await readFile(new URL('../src/vercel-runtime.ts', import.meta.url), 'utf8');

    expect(source).toContain('CanonicalOnlyDurableJobTransport');
    expect(source).toContain('connectionTimeoutMillis: 5_000');
    for (const forbidden of [
      'PgBossDurableJobTransport',
      'EvolutionClient',
      'setInterval',
      'setTimeout',
      '.listen(',
      'writeFile',
      'node:fs',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('ignores ambient OIDC state and enables Gateway composition only from invocation identity', () => {
    const ambient = {
      APP_ENV: 'test',
      JARVIS_MODEL_PROVIDER: 'vercel-ai-gateway',
      JARVIS_ZERO_COST_MODE: 'false',
      VERCEL_OIDC_TOKEN: 'ambient-token-must-be-ignored',
    };

    const missingIdentity = loadApiEnvironment(environmentSourceForVercelInvocation({}, ambient));
    const requestIdentity = loadApiEnvironment(
      environmentSourceForVercelInvocation({ oidcToken: 'request-scoped-token' }, ambient),
    );

    expect(missingIdentity.model.oidcToken).toBeUndefined();
    expect(requestIdentity.model.oidcToken).toBe('request-scoped-token');
    expect(createConfiguredModelGateway(missingIdentity.model)).toBeInstanceOf(
      NotConfiguredModelGateway,
    );
    expect(createConfiguredModelGateway(requestIdentity.model)).toBeInstanceOf(
      VercelAiGatewayModelGateway,
    );
    expect(ambient.VERCEL_OIDC_TOKEN).toBe('ambient-token-must-be-ignored');
  });
});
