import type { EnvironmentSource } from '@jarvis/config';

export * from './phase-one-fakes.js';

export function createTestEnvironment(overrides: EnvironmentSource = {}): EnvironmentSource {
  return {
    APP_ENV: 'test',
    ...overrides,
  };
}
