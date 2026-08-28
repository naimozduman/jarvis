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
});
