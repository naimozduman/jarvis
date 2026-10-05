import { z } from 'zod';
import { utcTimestampSchema, uuidSchema } from './common.js';

const ownerBaselineCapturePattern =
  /(?:^|\n)\s*(?:my (?:personal )?baseline\s*:|benim (?:kişisel )?temelim\s*:|my (?:main )?goals (?:for|are)|these are the projects i['’]?m actively working on|these things are non-negotiable|i prefer .+ (?:answers|responses)|this person is important to me because|i['’]?m trying to accomplish .+ before|(?:goals|projects|commitments|priorities|non-negotiables|hedefler|projeler|taahhütler|öncelikler)\s*:)/iu;
/** Shared intake and history-projection boundary: draft baseline source is not general context. */
export function isOwnerBaselineCapture(message: string): boolean {
  return ownerBaselineCapturePattern.test(message.trim());
}

export function ownerNamesPersonalContext(
  name: unknown,
  ownerMessage: string | undefined,
): boolean {
  if (
    typeof name !== 'string' ||
    !name ||
    !ownerMessage ||
    /^(?:me|my|i|you|owner|person|people|relationship|friend|mentor|family|ben|benim|kişi|arkadaş|aile)$/iu.test(
      name,
    )
  )
    return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'iu').test(
    ownerMessage,
  );
}
export const ownerBaselineKindSchema = z.enum([
  'constitution_candidate',
  'fact',
  'preference',
  'person',
  'relationship',
  'project',
  'open_loop',
  'commitment',
  'observation',
  'hypothesis',
]);

/** Draft extraction metadata carried by the existing memory-candidate envelope. */
export const ownerBaselineProposalSchema = z
  .object({
    kind: ownerBaselineKindSchema,
    title: z.string().trim().min(1).max(160),
    statement: z.string().trim().min(1).max(800),
    sourceQuote: z.string().trim().min(1).max(1_000),
    confidenceBasisPoints: z.number().int().min(0).max(9_000),
    sensitivity: z.enum(['normal', 'sensitive', 'restricted']),
    temporary: z.boolean(),
    validUntil: utcTimestampSchema.nullable(),
    /** Server-derived private retrieval scope; model values are overwritten from current evidence. */
    personalContextName: z.string().trim().min(1).max(160).nullable().default(null),
  })
  .strict();

export const ownerBaselineItemSchema = ownerBaselineProposalSchema.extend({
  candidateId: uuidSchema,
  ordinal: z.number().int().min(1).max(24),
  excluded: z.boolean(),
  acceptedMemoryRecordId: uuidSchema.nullable(),
  constitutionItemId: uuidSchema.nullable(),
  entityId: uuidSchema.nullable(),
});

export interface OwnerBaselineReview {
  readonly questionnaireId: string;
  readonly revision: string;
  readonly items: readonly OwnerBaselineItem[];
  readonly reviewed: boolean;
  readonly presentedRevision: string | null;
  readonly pendingCorrection: {
    readonly operation: 'exclude' | 'change' | 'temporary' | 'not_goal';
    readonly ordinal: number | null;
  } | null;
}

export const ownerBaselineOperationSchema = z
  .object({
    questionnaireId: uuidSchema,
    expectedRevision: z.string().max(64).nullable(),
    operation: z.enum([
      'stage',
      'confirm',
      'exclude',
      'change',
      'temporary',
      'not_goal',
      'select',
      'review',
    ]),
    proposals: z.array(ownerBaselineProposalSchema).max(24),
    ordinal: z.number().int().min(1).max(24).nullable(),
    replacement: z.string().trim().min(1).max(800).nullable(),
    validUntil: utcTimestampSchema.nullable(),
    pendingCorrection: z
      .object({
        operation: z.enum(['exclude', 'change', 'temporary', 'not_goal']),
        ordinal: z.number().int().min(1).max(24).nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type OwnerBaselineKind = z.infer<typeof ownerBaselineKindSchema>;
export type OwnerBaselineProposal = z.infer<typeof ownerBaselineProposalSchema>;
export type OwnerBaselineItem = z.infer<typeof ownerBaselineItemSchema>;
export type OwnerBaselineOperation = z.infer<typeof ownerBaselineOperationSchema>;
