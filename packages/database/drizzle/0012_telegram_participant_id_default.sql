-- Reconciliation addition: align the retained 0011 table with standardColumns.id.defaultRandom().
-- Preserve 0011 exactly; existing participant identities are unchanged.
ALTER TABLE "jarvis"."telegram_bot_participants" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
