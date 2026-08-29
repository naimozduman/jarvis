import { z } from 'zod';

import { utcTimestampSchema, uuidSchema } from './common.js';

export const onboardingSectionSchema = z.enum([
  'identity',
  'timezone_and_sleep',
  'constitution',
  'work_and_school',
  'training_and_health',
  'finance_rules',
  'relationships',
  'communication',
  'recurring_responsibilities',
  'hard_prohibitions',
]);

export const onboardingAnswerStateSchema = z.enum([
  'unanswered',
  'draft',
  'reviewed',
  'accepted',
  'rejected',
]);

export const onboardingQuestionSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    section: onboardingSectionSchema,
    prompt: z.string().trim().min(1).max(1_000),
    required: z.boolean(),
    reviewRequired: z.boolean(),
  })
  .strict();

export const onboardingAnswerSchema = z
  .object({
    id: uuidSchema,
    ownerId: uuidSchema,
    questionId: z.string().trim().min(1).max(160),
    state: onboardingAnswerStateSchema,
    value: z.string().trim().min(1).max(4_000).nullable(),
    source: z.enum(['owner_input', 'import']),
    reviewedAt: utcTimestampSchema.nullable(),
    createdAt: utcTimestampSchema,
    updatedAt: utcTimestampSchema,
  })
  .strict();

export type OnboardingSection = z.infer<typeof onboardingSectionSchema>;
export type OnboardingAnswerState = z.infer<typeof onboardingAnswerStateSchema>;
export type OnboardingQuestion = z.infer<typeof onboardingQuestionSchema>;
export type OnboardingAnswer = z.infer<typeof onboardingAnswerSchema>;
