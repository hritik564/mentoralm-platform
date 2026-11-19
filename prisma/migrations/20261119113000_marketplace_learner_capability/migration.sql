-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MarketplaceCommerceEventKind" ADD VALUE 'MarketplaceLearnerProvisioned';
ALTER TYPE "MarketplaceCommerceEventKind" ADD VALUE 'MarketplaceLmsAccessGranted';
ALTER TYPE "MarketplaceCommerceEventKind" ADD VALUE 'MarketplaceLmsAccessReused';

-- AlterTable
ALTER TABLE "MarketplaceDelivery" ADD COLUMN     "learnerIdentityProvenance" "MarketplaceEnrollmentProvenance" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "lmsAccessProvenance" "MarketplaceEnrollmentProvenance" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "MarketplaceLearnerIdentity" (
    "userId" TEXT NOT NULL,
    "createdByDeliveryId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceLearnerIdentity_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceLearnerIdentity_createdByDeliveryId_key" ON "MarketplaceLearnerIdentity"("createdByDeliveryId");

-- AddForeignKey
ALTER TABLE "MarketplaceLearnerIdentity" ADD CONSTRAINT "MarketplaceLearnerIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceLearnerIdentity" ADD CONSTRAINT "MarketplaceLearnerIdentity_createdByDeliveryId_fkey" FOREIGN KEY ("createdByDeliveryId") REFERENCES "MarketplaceDelivery"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Retain the canonical issuer, sequence, formatting and immutable-ID protections.
-- Only eligibility expands; no existing IDs/personas/profiles/history are rewritten.
CREATE OR REPLACE FUNCTION issue_student_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  serial_value text;
  marketplace_identity boolean := false;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."studentId" IS NOT NULL
     AND NEW."studentId" IS DISTINCT FROM OLD."studentId"
  THEN
    RAISE EXCEPTION 'Student identifier is immutable';
  END IF;

  IF TG_OP = 'INSERT' AND NEW."studentId" IS NOT NULL THEN
    RAISE EXCEPTION 'Student identifier must be generated';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD."studentId" IS NULL
     AND NEW."studentId" IS NOT NULL
  THEN
    RAISE EXCEPTION 'Student identifier must be generated';
  END IF;

  IF NEW."studentId" IS NULL THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I."MarketplaceLearnerIdentity" WHERE "userId"=$1)', TG_TABLE_SCHEMA)
      INTO marketplace_identity USING NEW.id;
  END IF;

  IF (NEW."role" = 'STUDENT' OR marketplace_identity) AND NEW."studentId" IS NULL THEN
    serial_value :=
      nextval(
        format('%I.%I', TG_TABLE_SCHEMA, 'student_id_seq')::regclass
      )::text;

    NEW."studentId" :=
      'ST-' ||
      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY') ||
      '-' ||
      CASE
        WHEN length(serial_value) < 6
          THEN lpad(serial_value, 6, '0')
        ELSE serial_value
      END;
  END IF;

  RETURN NEW;
END;
$$;


CREATE FUNCTION validate_marketplace_learner_origin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE valid boolean;
BEGIN
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I."MarketplaceDelivery" d JOIN %I."MarketplaceEntitlement" e ON e.id=d."entitlementId" WHERE d.id=$1 AND e."userId"=$2 AND e.status=''ACTIVE'' AND d.type=''LMS'' AND d.status=''PROVISIONING'')',TG_TABLE_SCHEMA,TG_TABLE_SCHEMA)
 INTO valid USING NEW."createdByDeliveryId",NEW."userId";
 IF NOT valid THEN RAISE EXCEPTION 'Learner identity requires authorized provisioning'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER marketplace_learner_origin BEFORE INSERT ON "MarketplaceLearnerIdentity" FOR EACH ROW EXECUTE FUNCTION validate_marketplace_learner_origin();
CREATE TRIGGER marketplace_learner_immutable BEFORE UPDATE OR DELETE ON "MarketplaceLearnerIdentity" FOR EACH ROW EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE TRIGGER marketplace_learner_no_truncate BEFORE TRUNCATE ON "MarketplaceLearnerIdentity" FOR EACH STATEMENT EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();

CREATE FUNCTION validate_marketplace_learner_completion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE valid boolean;
BEGIN
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I."MarketplaceDelivery" d JOIN %I."User" u ON u.id=$2 WHERE d.id=$1 AND d.status=''ACTIVE'' AND d."learnerIdentityProvenance"=''CREATED'' AND d."lmsAccessProvenance"<>''NONE'' AND u."studentId" IS NOT NULL)',TG_TABLE_SCHEMA,TG_TABLE_SCHEMA)
 INTO valid USING NEW."createdByDeliveryId",NEW."userId";
 IF NOT valid THEN RAISE EXCEPTION 'Learner provisioning must complete atomically'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER marketplace_learner_completion AFTER INSERT ON "MarketplaceLearnerIdentity" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_marketplace_learner_completion();

ALTER TABLE "MarketplaceDelivery" ADD CONSTRAINT marketplace_learner_provenance_bounds CHECK (
 ("learnerIdentityProvenance"='NONE' AND "lmsAccessProvenance"='NONE') OR
 (type='LMS' AND "learnerIdentityProvenance"<>'NONE' AND "lmsAccessProvenance"<>'NONE' AND "enrollmentId" IS NOT NULL AND "provisionedAt" IS NOT NULL)
);
CREATE FUNCTION protect_marketplace_learner_provenance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."lmsAccessProvenance"<>'NONE' AND ROW(NEW."learnerIdentityProvenance",NEW."lmsAccessProvenance") IS DISTINCT FROM ROW(OLD."learnerIdentityProvenance",OLD."lmsAccessProvenance") THEN
 RAISE EXCEPTION 'Learner grant provenance is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER marketplace_learner_provenance BEFORE UPDATE ON "MarketplaceDelivery" FOR EACH ROW EXECUTE FUNCTION protect_marketplace_learner_provenance();

CREATE FUNCTION validate_marketplace_delivery_learner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d RECORD; u RECORD; e RECORD; valid boolean;
BEGIN
 EXECUTE format('SELECT * FROM %I."MarketplaceDelivery" WHERE id=$1',TG_TABLE_SCHEMA) INTO d USING NEW.id;
 IF d."lmsAccessProvenance"::text='NONE' THEN RETURN NULL; END IF;
 EXECUTE format('SELECT * FROM %I."MarketplaceEntitlement" WHERE id=$1',TG_TABLE_SCHEMA) INTO e USING d."entitlementId";
 EXECUTE format('SELECT * FROM %I."User" WHERE id=$1',TG_TABLE_SCHEMA) INTO u USING e."userId";
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I."MarketplaceLearnerIdentity" WHERE "userId"=$1 AND ($2<>''CREATED'' OR "createdByDeliveryId"=$3))',TG_TABLE_SCHEMA)
 INTO valid USING u.id,d."learnerIdentityProvenance"::text,d.id;
 IF u."studentId" IS NULL OR (u.role::text<>'STUDENT' AND NOT valid) OR (d."learnerIdentityProvenance"::text='CREATED' AND NOT valid) THEN
 RAISE EXCEPTION 'Delivery requires valid learner identity'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER marketplace_delivery_learner_valid AFTER INSERT OR UPDATE ON "MarketplaceDelivery" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_marketplace_delivery_learner();
