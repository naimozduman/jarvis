import { describe, expect, it } from 'vitest';

import { EnvironmentValidationError, loadApiEnvironment } from '@jarvis/config';
import { createTestEnvironment } from '@jarvis/testing';

describe('loadApiEnvironment', () => {
  it('uses safe test defaults without provider credentials', () => {
    const environment = loadApiEnvironment(createTestEnvironment());

    expect(environment).toMatchObject({
      appEnvironment: 'test',
      appUrl: 'http://localhost:3000',
      apiUrl: 'http://localhost:4000',
      providerIntegrationsEnabled: false,
    });
  });

  it('fails closed for missing production foundation variables without echoing values', () => {
    const suppliedValue = 'phase0-value-that-must-not-appear-in-errors';

    try {
      loadApiEnvironment({
        APP_ENV: 'production',
        ENCRYPTION_KEY_CURRENT: suppliedValue,
      });
      throw new Error('Expected production environment validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);

      if (!(error instanceof EnvironmentValidationError)) {
        throw error;
      }

      expect(error.fields).toEqual(
        expect.arrayContaining(['APP_URL', 'API_URL', 'ALLOWED_USER_EMAIL', 'DATABASE_URL']),
      );
      expect(error.message).not.toContain(suppliedValue);
    }
  });

  it('treats staging as a server environment rather than a development alias', () => {
    expect(() => loadApiEnvironment({ APP_ENV: 'staging' })).toThrow(EnvironmentValidationError);

    const environment = loadApiEnvironment({
      APP_ENV: 'staging',
      DATABASE_URL: 'postgresql://staging.invalid/jarvis',
      PORT: '4310',
    });
    expect(environment).toMatchObject({
      appEnvironment: 'staging',
      databaseUrl: 'postgresql://staging.invalid/jarvis',
      apiPort: 4310,
      workerHealthPort: 4310,
    });
    expect(environment.appEnvironment).not.toBe('development');
  });

  it('keeps Evolution disabled by default and rejects vulnerable or production source-build activation', () => {
    expect(loadApiEnvironment(createTestEnvironment()).evolution).toMatchObject({ enabled: false });

    const base = {
      APP_ENV: 'test',
      PROVIDER_INTEGRATIONS_ENABLED: 'true',
      JARVIS_EVOLUTION_ENABLED: 'true',
      JARVIS_OWNER_ID: '00000000-0000-4000-8000-000000000001',
      JARVIS_WHATSAPP_INSTANCE: 'jarvis-test-instance',
      JARVIS_OWNER_PHONE: '+15551234567',
      JARVIS_OWNER_WHATSAPP_LID: '123456789@lid',
      EVOLUTION_BASE_URL: 'http://evolution.private',
      EVOLUTION_API_KEY: 'test-only-api-material-not-a-deployment-credential',
      EVOLUTION_WEBHOOK_SECRET: 'phase3-test-signing-material-not-a-deployment-credential',
      EVOLUTION_PROVIDER_BUILD_ID: 'e273b904d53f5726970fd6a244ed9caa61dfeb9a',
      EVOLUTION_BAILEYS_VERSION: '7.0.0-rc13',
      EVOLUTION_IMAGE_DIGEST: `sha256:${'a'.repeat(64)}`,
      EVOLUTION_ALLOW_UNSTABLE_SOURCE_BUILD: 'true',
    } as const;
    expect(loadApiEnvironment(base).evolution).toMatchObject({
      enabled: true,
      ownerWhatsAppLid: '123456789@lid',
    });
    expect(() => loadApiEnvironment({ ...base, EVOLUTION_BAILEYS_VERSION: '7.0.0-rc9' })).toThrow(
      EnvironmentValidationError,
    );
    expect(
      loadApiEnvironment({
        ...base,
        APP_ENV: 'staging',
        DATABASE_URL: 'postgresql://staging.invalid/jarvis',
      }).evolution,
    ).toMatchObject({
      enabled: true,
    });
    expect(() => loadApiEnvironment({ ...base, APP_ENV: 'production' })).toThrow(
      EnvironmentValidationError,
    );
  });

  it('fails closed until every server-side official Cloud API ingress boundary is configured', () => {
    const base = {
      APP_ENV: 'test',
      PROVIDER_INTEGRATIONS_ENABLED: 'true',
      JARVIS_OWNER_ID: '00000000-0000-4000-8000-000000000001',
      JARVIS_WHATSAPP_CLOUD_INGEST_ENABLED: 'true',
      JARVIS_INGEST_TOKEN: 'cloud-ingest-test-token-that-is-not-a-deployment-secret',
      JARVIS_WHATSAPP_CLOUD_INGEST_INSTANCE_ID: 'naim',
      JARVIS_CONVEX_ORCHESTRATION_URL: 'https://orchestration.invalid',
      JARVIS_VERCEL_TO_CONVEX_SECRET: 'vercel-to-convex-test-secret-material-0001',
      JARVIS_CONVEX_TO_VERCEL_SECRET: 'convex-to-vercel-test-secret-material-0001',
    } as const;

    expect(() =>
      loadApiEnvironment({
        ...base,
        JARVIS_INGEST_TOKEN: undefined,
      }),
    ).toThrow(EnvironmentValidationError);
    expect(loadApiEnvironment(base)).toMatchObject({
      ownerId: '00000000-0000-4000-8000-000000000001',
      providerIntegrationsEnabled: true,
      whatsappCloudIngest: {
        enabled: true,
        expectedInstanceId: 'naim',
      },
    });
  });

  it('requires a separate explicit bridge boundary before verified-owner Cloud messages can reply', () => {
    const base = {
      APP_ENV: 'test',
      PROVIDER_INTEGRATIONS_ENABLED: 'true',
      JARVIS_OWNER_ID: '00000000-0000-4000-8000-000000000001',
      JARVIS_WHATSAPP_CLOUD_INGEST_ENABLED: 'true',
      JARVIS_INGEST_TOKEN: 'cloud-ingest-test-token-that-is-not-a-deployment-secret',
      JARVIS_WHATSAPP_CLOUD_INGEST_INSTANCE_ID: 'naim',
      JARVIS_CONVEX_ORCHESTRATION_URL: 'https://orchestration.invalid',
      JARVIS_VERCEL_TO_CONVEX_SECRET: 'vercel-to-convex-test-secret-material-0001',
      JARVIS_CONVEX_TO_VERCEL_SECRET: 'convex-to-vercel-test-secret-material-0001',
      JARVIS_WHATSAPP_CLOUD_OWNER_DM_ENABLED: 'true',
    } as const;

    expect(() => loadApiEnvironment(base)).toThrow(EnvironmentValidationError);
    const configured = loadApiEnvironment({
      ...base,
      JARVIS_WHATSAPP_CLOUD_DELIVERY_BRIDGE_URL: 'https://bridge.invalid',
      JARVIS_WHATSAPP_CLOUD_DELIVERY_TOKEN:
        'cloud-delivery-test-token-that-is-not-a-deployment-secret',
      JARVIS_WHATSAPP_CLOUD_DELIVERY_BRIDGE_ID: 'jarvis-cloud-bridge',
    });
    expect(configured.whatsappCloudIngest).toMatchObject({
      enabled: true,
      ownerDirectMessagingEnabled: true,
      deliveryBridgeUrl: 'https://bridge.invalid',
      deliveryBridgeId: 'jarvis-cloud-bridge',
    });
  });
});
