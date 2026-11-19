-- Financial permissions are explicit and are never backfilled/granted.
ALTER TYPE "AdminPermission" ADD VALUE 'COMMERCE_VIEW';
ALTER TYPE "AdminPermission" ADD VALUE 'COMMERCE_MANAGE';
