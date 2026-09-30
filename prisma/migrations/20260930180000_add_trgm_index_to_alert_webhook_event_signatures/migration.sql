-- The by-signature lookup matches with ILIKE '%<signature>%'. A btree index
-- cannot serve a leading wildcard, so every lookup scanned the whole table.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "AlertWebhookEvent_signatures_trgm_idx" ON "AlertWebhookEvent" USING GIN ("signatures" gin_trgm_ops);
