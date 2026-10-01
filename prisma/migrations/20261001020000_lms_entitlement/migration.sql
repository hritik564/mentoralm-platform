-- Entitlement is MentoraLM business data. Existing users inherit, batches deny by default.
CREATE TYPE "LmsAccessOverride" AS ENUM ('ENABLED', 'DISABLED');
ALTER TABLE "User" ADD COLUMN "lmsAccessOverride" "LmsAccessOverride";
ALTER TABLE "Batch" ADD COLUMN "lmsAccessEnabled" BOOLEAN NOT NULL DEFAULT false;
