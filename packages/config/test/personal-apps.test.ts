import { describe, expect, it } from 'vitest';
import {
  EnvironmentValidationError,
  loadApiEnvironment,
  loadWebEnvironment,
} from '../src/index.js';
const token = 'synthetic-owner-system-config-material-only';
describe('server-only owner-system configuration', () => {
  it('defaults disconnected and accepts complete HTTPS credential pairs', () => {
    expect(loadApiEnvironment({ APP_ENV: 'test' }).personalApps).toEqual({});
    expect(
      loadApiEnvironment({
        APP_ENV: 'test',
        GROWTH_API_URL: 'https://growth.example.invalid',
        GROWTH_API_TOKEN: token,
      }).personalApps.growth,
    ).toEqual({ baseUrl: 'https://growth.example.invalid', token });
  });
  it('never includes credentials in web configuration', () => {
    const web = loadWebEnvironment({
      APP_ENV: 'test',
      OURHOURS_API_URL: 'https://hours.example.invalid',
      OURHOURS_API_TOKEN: token,
    });
    expect(web).not.toHaveProperty('personalApps');
    expect(JSON.stringify(web)).not.toContain(token);
  });
  it.each(['GROWTH', 'OURHOURS', 'IRON'])(
    'rejects incomplete %s pairs without exposing their values',
    (prefix) => {
      for (const fields of [
        { [`${prefix}_API_URL`]: 'https://app.example.invalid' },
        { [`${prefix}_API_TOKEN`]: token },
      ]) {
        try {
          loadApiEnvironment({ APP_ENV: 'test', ...fields });
          throw new Error('should reject');
        } catch (error) {
          expect(error).toBeInstanceOf(EnvironmentValidationError);
          expect(String(error)).not.toContain(token);
        }
      }
    },
  );
  it.each([
    'http://app.example.invalid',
    'https://user:password@app.example.invalid',
    'https://app.example.invalid/api/jarvis',
    'https://app.example.invalid?secret=value',
  ])('rejects unsafe service origins %s', (url) => {
    expect(() =>
      loadApiEnvironment({ APP_ENV: 'test', IRON_API_URL: url, IRON_API_TOKEN: token }),
    ).toThrow(EnvironmentValidationError);
  });
});

describe('personal-system read gateway configuration', () => {
  it('requires canonical owner identity and current token during overlap rotation', () => {
    expect(() =>
      loadApiEnvironment({ APP_ENV: 'test', JARVIS_PERSONAL_SYSTEM_READ_TOKEN: token }),
    ).toThrow(EnvironmentValidationError);
    expect(() =>
      loadApiEnvironment({ APP_ENV: 'test', JARVIS_PERSONAL_SYSTEM_READ_TOKEN_NEXT: token }),
    ).toThrow(EnvironmentValidationError);
    const source = {
      APP_ENV: 'test',
      JARVIS_OWNER_ID: '00000000-0000-4000-8000-000000000001',
      JARVIS_PERSONAL_SYSTEM_READ_TOKEN: token,
    };
    expect(loadApiEnvironment(source).personalSystemRead.token).toBe(token);
    expect(JSON.stringify(loadWebEnvironment(source))).not.toContain(token);
  });
});
