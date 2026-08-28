import { z } from 'zod';

import { utcTimestampSchema, uuidSchema } from './common.js';

export const authenticatedPrincipalSchema = z.object({
  ownerId: uuidSchema,
  subjectId: uuidSchema,
  authMethod: z.enum(['session', 'trusted_client', 'future_passkey', 'test']),
  scopes: z.array(z.string().trim().min(1)).readonly(),
  deviceId: uuidSchema.optional(),
  reauthenticatedAt: utcTimestampSchema.optional(),
});

export const ownerScopedRequestSchema = z.object({
  ownerId: uuidSchema,
});

export type AuthenticatedPrincipal = z.infer<typeof authenticatedPrincipalSchema>;
export type OwnerScopedRequest = z.infer<typeof ownerScopedRequestSchema>;
