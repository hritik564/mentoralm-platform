-- CHECK expressions accept UNKNOWN in PostgreSQL. Require the creator FK explicitly
-- so a CREATED enrollment cannot be mistaken for an independent access grant.
ALTER TABLE "MarketplaceDelivery" ADD CONSTRAINT marketplace_delivery_creator_required
CHECK (provenance <> 'CREATED' OR "createdEnrollmentId" IS NOT NULL);
