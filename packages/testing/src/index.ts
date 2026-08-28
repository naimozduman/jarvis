import type { EnvironmentSource } from '@jarvis/config';

export function createTestEnvironment(overrides: EnvironmentSource = {}): EnvironmentSource {
  return {
    APP_ENV: 'test',
    ...overrides,
  };
}
