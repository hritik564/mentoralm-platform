-- CreateEnum
CREATE TYPE "MarketplaceDeliveryType" AS ENUM ('EXTERNAL', 'LMS');

-- CreateEnum
CREATE TYPE "MarketplaceDeliveryStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PROVISIONING', 'ACTIVE', 'FAILED', 'REVOKE_PENDING', 'REVOKED', 'REVIEW');

-- CreateEnum
CREATE TYPE "MarketplaceEnrollmentProvenance" AS ENUM ('NONE', 'CREATED', 'REUSED');

-- CreateTable
CREATE TABLE "MarketplaceDelivery" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "type" "MarketplaceDeliveryType" NOT NULL,
    "status" "MarketplaceDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "courseId" TEXT,
    "enrollmentId" TEXT,
    "createdEnrollmentId" TEXT,
    "provenance" "MarketplaceEnrollmentProvenance" NOT NULL DEFAULT 'NONE',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMPTZ(6),
    "lastErrorCode" TEXT,
    "provisionedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "revision" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MarketplaceDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceDelivery_publicRef_key" ON "MarketplaceDelivery"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceDelivery_entitlementId_key" ON "MarketplaceDelivery"("entitlementId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceDelivery_createdEnrollmentId_key" ON "MarketplaceDelivery"("createdEnrollmentId");

-- CreateIndex
CREATE INDEX "MarketplaceDelivery_status_lastAttemptAt_idx" ON "MarketplaceDelivery"("status", "lastAttemptAt");

-- CreateIndex
CREATE INDEX "MarketplaceDelivery_enrollmentId_idx" ON "MarketplaceDelivery"("enrollmentId");

-- CreateIndex
CREATE INDEX "MarketplaceDelivery_courseId_idx" ON "MarketplaceDelivery"("courseId");

-- AddForeignKey
ALTER TABLE "MarketplaceDelivery" ADD CONSTRAINT "MarketplaceDelivery_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "MarketplaceEntitlement"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceDelivery" ADD CONSTRAINT "MarketplaceDelivery_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceDelivery" ADD CONSTRAINT "MarketplaceDelivery_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceDelivery" ADD CONSTRAINT "MarketplaceDelivery_createdEnrollmentId_fkey" FOREIGN KEY ("createdEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


CREATE OR REPLACE FUNCTION valid_admin_permissions(p "AdminPermission"[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT p IS NOT NULL AND cardinality(p)<=16 AND (cardinality(p)=0 OR array_ndims(p)=1)
 AND NOT EXISTS(SELECT 1 FROM unnest(p) v WHERE v IS NULL)
 AND cardinality(p)=(SELECT count(DISTINCT v) FROM unnest(p) v);
$$;
ALTER TABLE "MarketplaceDelivery" ADD CONSTRAINT marketplace_delivery_bounds CHECK (
 "publicRef" ~ '^[A-Za-z0-9_-]{43}$' AND "attemptCount">=0
 AND ("lastErrorCode" IS NULL OR "lastErrorCode" ~ '^[A-Z_]{1,64}$')
 AND (status<>'ACTIVE' OR (type='LMS' AND "enrollmentId" IS NOT NULL AND "provisionedAt" IS NOT NULL))
 AND (status<>'NOT_REQUIRED' OR type='EXTERNAL')
 AND (status<>'REVOKED' OR "revokedAt" IS NOT NULL)
 AND ((provenance='NONE' AND "enrollmentId" IS NULL AND "createdEnrollmentId" IS NULL)
 OR (provenance='REUSED' AND "enrollmentId" IS NOT NULL AND "createdEnrollmentId" IS NULL)
 OR (provenance='CREATED' AND "enrollmentId" IS NOT NULL AND "createdEnrollmentId"="enrollmentId"))
);
CREATE FUNCTION protect_marketplace_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."entitlementId",NEW."publicRef",NEW.type,NEW."createdAt") IS DISTINCT FROM ROW(OLD."entitlementId",OLD."publicRef",OLD.type,OLD."createdAt")
 OR (OLD."enrollmentId" IS NOT NULL AND ROW(NEW."enrollmentId",NEW."createdEnrollmentId",NEW.provenance,NEW."courseId") IS DISTINCT FROM ROW(OLD."enrollmentId",OLD."createdEnrollmentId",OLD.provenance,OLD."courseId"))
 OR NEW."attemptCount"<OLD."attemptCount" OR (OLD.status='REVOKED' AND NEW.status<>'REVOKED')
 THEN RAISE EXCEPTION 'Delivery identity, provenance and history are immutable'; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER marketplace_delivery_immutable BEFORE UPDATE ON "MarketplaceDelivery" FOR EACH ROW EXECUTE FUNCTION protect_marketplace_delivery();
CREATE FUNCTION validate_marketplace_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d RECORD; e RECORD; n RECORD;
BEGIN
 EXECUTE format('SELECT * FROM %I."MarketplaceDelivery" WHERE id=$1',TG_TABLE_SCHEMA) INTO d USING NEW.id;
 IF d.id IS NULL THEN RETURN NULL; END IF;
 EXECUTE format('SELECT * FROM %I."MarketplaceEntitlement" WHERE id=$1',TG_TABLE_SCHEMA) INTO e USING d."entitlementId";
 IF d.status::text='ACTIVE' AND e.status::text<>'ACTIVE' THEN RAISE EXCEPTION 'Active delivery requires commercial ownership'; END IF;
 IF d."enrollmentId" IS NOT NULL THEN
  EXECUTE format('SELECT * FROM %I."Enrollment" WHERE id=$1',TG_TABLE_SCHEMA) INTO n USING d."enrollmentId";
  IF n."userId" IS DISTINCT FROM e."userId" OR n."courseId" IS DISTINCT FROM d."courseId" THEN RAISE EXCEPTION 'Delivery Enrollment ownership mismatch'; END IF;
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER marketplace_delivery_consistency AFTER INSERT OR UPDATE ON "MarketplaceDelivery" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_marketplace_delivery();
CREATE TRIGGER marketplace_delivery_no_delete BEFORE DELETE ON "MarketplaceDelivery" FOR EACH ROW EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE TRIGGER marketplace_delivery_no_truncate BEFORE TRUNCATE ON "MarketplaceDelivery" FOR EACH STATEMENT EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();

CREATE FUNCTION protect_marketplace_enrollment_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE referenced boolean;
BEGIN
 IF ROW(NEW."userId",NEW."courseId") IS DISTINCT FROM ROW(OLD."userId",OLD."courseId") THEN
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I."MarketplaceDelivery" WHERE "enrollmentId"=$1)',TG_TABLE_SCHEMA) INTO referenced USING OLD.id;
 IF referenced THEN RAISE EXCEPTION 'Delivery Enrollment identity is immutable'; END IF;
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER marketplace_enrollment_identity BEFORE UPDATE ON "Enrollment" FOR EACH ROW EXECUTE FUNCTION protect_marketplace_enrollment_identity();
