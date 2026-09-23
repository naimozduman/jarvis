import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { registerPhase3d1JobRecoveryRoute } from '../src/phase-3-6d1-job-recovery-route.js';

const accessToken = 'phase-3-6d1-route-unit-test-token-only';

describe('Phase 3.6D.1 exact recovery route', () => {
  it('is absent without its temporary credential', async () => {
    const app = Fastify({ logger: false });
    registerPhase3d1JobRecoveryRoute(app, undefined);
    try {
      expect(
        (await app.inject({ method: 'POST', url: '/internal/staging/phase-3-6d1-recover' }))
          .statusCode,
      ).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('requires authentication and an empty request before running the fixed operation', async () => {
    const recover = vi.fn().mockResolvedValue({
      jobId: '279bc54a-358b-4445-8460-acfc4af45384',
      generation: 1,
      published: true,
    });
    const app = Fastify({ logger: false });
    registerPhase3d1JobRecoveryRoute(app, { accessToken, recover });
    try {
      const unauthorized = await app.inject({
        method: 'POST',
        url: '/internal/staging/phase-3-6d1-recover',
      });
      const malformed = await app.inject({
        method: 'POST',
        url: '/internal/staging/phase-3-6d1-recover',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {},
      });
      expect(unauthorized.statusCode).toBe(401);
      expect(malformed.statusCode).toBe(400);
      expect(recover).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('runs exactly once and returns only the fixed safe receipt', async () => {
    const receipt = {
      jobId: '279bc54a-358b-4445-8460-acfc4af45384',
      generation: 1 as const,
      published: true as const,
    };
    const recover = vi.fn().mockResolvedValue(receipt);
    const app = Fastify({ logger: false });
    registerPhase3d1JobRecoveryRoute(app, { accessToken, recover });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/internal/staging/phase-3-6d1-recover',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(202);
      expect(response.json()).toEqual(receipt);
      expect(response.payload).not.toContain(accessToken);
      expect(recover).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });

  it('returns a fixed refusal without leaking an internal failure', async () => {
    const app = Fastify({ logger: false });
    registerPhase3d1JobRecoveryRoute(app, {
      accessToken,
      recover: vi.fn().mockRejectedValue(new Error('database details must not escape')),
    });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/internal/staging/phase-3-6d1-recover',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: 'recovery_refused' });
      expect(response.payload).not.toContain('database');
    } finally {
      await app.close();
    }
  });
});
