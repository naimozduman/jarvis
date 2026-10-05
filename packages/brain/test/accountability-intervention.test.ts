import { describe, expect, test } from 'vitest';

import { AccountabilityEngine, type AccountabilityInput } from '../src/accountability/engine.js';
import {
  InterventionRegistry,
  type InterventionRunHistory,
} from '../src/behavior/intervention-registry.js';
import { transitionForNoResponse } from '../src/reminders/ghosting.js';

const commitment: AccountabilityInput = {
  importance: 90,
  constitutionalRelevance: 90,
  deadlineMinutes: 240,
  remainingMinutes: 60,
  consequence: 'A missed draft leaves no review time.',
  minimumAcceptableVersion: 'Write the twenty-minute outline.',
  minimumMinutes: 20,
  dependenciesMet: true,
  previousMisses: 0,
  alternateWindowsToday: 0,
  nextProtectedWindowExists: false,
  explicitOwnerIntent: null,
  hardOverrideActive: false,
  ambiguityMatters: false,
};

describe('bounded accountability decisions', () => {
  const engine = new AccountabilityEngine();

  test('the deadline limits the viable action even when the owner has more free time', () => {
    expect(engine.evaluate({ ...commitment, deadlineMinutes: 20 })).toMatchObject({
      kind: 'reduce_to_minimum_viable_action',
      nextAction: commitment.minimumAcceptableVersion,
    });
  });

  test('a minimum action that extends past the deadline seeks a protected recovery slot', () => {
    expect(
      engine.evaluate({ ...commitment, deadlineMinutes: 5, nextProtectedWindowExists: true }),
    ).toMatchObject({ kind: 'move_to_next_protected_slot' });
  });

  test('limited available time still limits an action with a distant deadline', () => {
    expect(
      engine.evaluate({ ...commitment, remainingMinutes: 5, alternateWindowsToday: 1 }),
    ).toMatchObject({ kind: 'move_within_same_day' });
  });

  test('without a deadline, a known minimum action fits the available time', () => {
    expect(
      engine.evaluate({ ...commitment, deadlineMinutes: null, remainingMinutes: 25 }),
    ).toMatchObject({ kind: 'reduce_to_minimum_viable_action' });
  });

  test.each([
    { nextProtectedWindowExists: true, expected: 'move_to_next_protected_slot' },
    { nextProtectedWindowExists: false, expected: 'ask_one_clarification' },
  ])('an unmet dependency prevents continuation: $expected', ({ expected, ...constraints }) => {
    expect(engine.evaluate({ ...commitment, ...constraints, dependenciesMet: false }).kind).toBe(
      expected,
    );
  });

  test('a material ambiguity asks for one fact before changing the plan', () => {
    expect(engine.evaluate({ ...commitment, ambiguityMatters: true }).kind).toBe(
      'ask_one_clarification',
    );
  });

  test('a grounded important commitment may receive one challenge by default', () => {
    expect(engine.evaluate(commitment)).toMatchObject({
      kind: 'continue_original_plan',
      challengeLevel: 'direct',
    });
  });

  test.each([
    { remainingMinutes: 60 },
    { remainingMinutes: 25 },
    { remainingMinutes: 5, alternateWindowsToday: 1 },
    { remainingMinutes: 5, nextProtectedWindowExists: true },
    { deadlineMinutes: -1, previousMisses: 5 },
    { remainingMinutes: 0, previousMisses: 3 },
    { ambiguityMatters: true },
    { dependenciesMet: false },
  ])('an already challenged episode keeps its option without renewed pressure: %j', (state) => {
    const first = engine.evaluate({ ...commitment, ...state });
    const repeated = engine.evaluate({ ...commitment, ...state, alreadyChallenged: true });
    expect(repeated).toEqual({ ...first, challengeLevel: 'none' });
  });

  test('an explicit active hard override outranks accountability pressure and uncertainty', () => {
    expect(
      engine.evaluate({
        ...commitment,
        hardOverrideActive: true,
        explicitOwnerIntent: 'Keep this commitment open; I am overriding today only.',
        ambiguityMatters: true,
        dependenciesMet: false,
        deadlineMinutes: -1,
      }),
    ).toMatchObject({ kind: 'accept_explicit_hard_override', challengeLevel: 'none' });
  });

  test('a passed deadline records a miss and recovery instead of completion or deletion', () => {
    expect(engine.evaluate({ ...commitment, deadlineMinutes: -1, previousMisses: 5 }).kind).toBe(
      'record_miss_and_create_recovery_plan',
    );
  });

  test.each([
    { state: {}, expected: 'follow_up_scheduled' },
    { state: { quietModeActive: true }, expected: 'waiting' },
    { state: { maxFollowUpsReached: true }, expected: 'needs_review' },
    { state: { deadlinePassed: true, validReplanExists: true }, expected: 'replan_needed' },
    { state: { deadlinePassed: true }, expected: 'expired_without_completion' },
    { state: { completionEvidencePresent: true }, expected: 'needs_review' },
  ])('silence preserves review or recovery: $expected', ({ state, expected }) => {
    expect(
      transitionForNoResponse({
        current: 'waiting',
        reminderCooldownActive: false,
        quietModeActive: false,
        deadlinePassed: false,
        maxFollowUpsReached: false,
        validReplanExists: false,
        completionEvidencePresent: false,
        ...state,
      }),
    ).toBe(expected);
  });
});

describe('intervention cooldowns across complete history', () => {
  const registry = new InterventionRegistry();
  const now = '2026-10-02T12:00:00.000Z';
  const expired: InterventionRunHistory = {
    interventionId: 'minimum-viable-action',
    contextKey: 'training:previous-episode',
    cooldownUntil: '2026-10-01T16:00:00.000Z',
  };
  const active: InterventionRunHistory = {
    ...expired,
    contextKey: 'training:current-episode',
    cooldownUntil: '2026-10-02T16:00:00.000Z',
  };

  test.each([
    [expired, active],
    [active, expired],
    [{ ...expired, cooldownUntil: null }, active],
  ])(
    'any active run of the same tactic blocks it regardless of history order: %j',
    (...history) => {
      expect(registry.canRun({ interventionId: active.interventionId, now, history })).toBe(false);
    },
  );

  test('active cooldowns from other tactics do not block an eligible tactic', () => {
    expect(
      registry.canRun({
        interventionId: expired.interventionId,
        now,
        history: [expired, { ...active, interventionId: 'next-physical-action' }],
      }),
    ).toBe(true);
  });

  test('the tactic becomes eligible exactly when every matching cooldown has ended', () => {
    expect(
      registry.canRun({
        interventionId: expired.interventionId,
        now,
        history: [expired, { ...active, cooldownUntil: now }],
      }),
    ).toBe(true);
  });

  test('an unknown tactic cannot gain eligibility from an empty history', () => {
    expect(registry.canRun({ interventionId: 'unregistered-tactic', now, history: [] })).toBe(
      false,
    );
  });
});
