-- Marketplace is a separate persisted Admin capability.
-- No role grants, backfill, table changes or business-data writes.
ALTER TYPE "AdminPermission" ADD VALUE 'MARKETPLACE_MANAGE';
