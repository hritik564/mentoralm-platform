-- CreateEnum
CREATE TYPE "MarketplaceIntentState" AS ENUM ('ACCOUNT_REQUIRED', 'ONBOARDING_REQUIRED', 'READY_FOR_CHECKOUT', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketplaceEnrollmentEventKind" AS ENUM ('EnrollmentIntentCreated', 'EnrollmentIntentClaimed', 'EnrollmentOnboardingUpdated', 'EnrollmentReadyForCheckout', 'EnrollmentIntentCancelled');

-- CreateTable
CREATE TABLE "MarketplaceEnrollmentIntent" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "revision" UUID NOT NULL,
    "userId" TEXT,
    "browserHash" TEXT,
    "offeringId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "durationLabel" TEXT NOT NULL,
    "deliveryMode" "MarketplaceDeliveryMode" NOT NULL,
    "cohortStartsAt" TIMESTAMPTZ(6),
    "state" "MarketplaceIntentState" NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MarketplaceEnrollmentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceEnrollmentOnboarding" (
    "intentId" TEXT NOT NULL,
    "completedStep" INTEGER NOT NULL DEFAULT 0,
    "fullName" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "educationLevel" TEXT,
    "currentStatus" TEXT,
    "institution" TEXT,
    "goal" TEXT,
    "source" TEXT,
    "consentVersion" TEXT,
    "completedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MarketplaceEnrollmentOnboarding_pkey" PRIMARY KEY ("intentId")
);

-- CreateTable
CREATE TABLE "MarketplaceEnrollmentEvent" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" "MarketplaceEnrollmentEventKind" NOT NULL,
    "beforeState" "MarketplaceIntentState",
    "afterState" "MarketplaceIntentState" NOT NULL,
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceEnrollmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceEnrollmentIntent_publicRef_key" ON "MarketplaceEnrollmentIntent"("publicRef");

-- CreateIndex
CREATE INDEX "MarketplaceEnrollmentIntent_userId_offeringId_expiresAt_idx" ON "MarketplaceEnrollmentIntent"("userId", "offeringId", "expiresAt");

-- CreateIndex
CREATE INDEX "MarketplaceEnrollmentIntent_browserHash_offeringId_expiresA_idx" ON "MarketplaceEnrollmentIntent"("browserHash", "offeringId", "expiresAt");

-- CreateIndex
CREATE INDEX "MarketplaceEnrollmentEvent_intentId_createdAt_idx" ON "MarketplaceEnrollmentEvent"("intentId", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketplaceEnrollmentIntent" ADD CONSTRAINT "MarketplaceEnrollmentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceEnrollmentIntent" ADD CONSTRAINT "MarketplaceEnrollmentIntent_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "MarketplaceOffering"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceEnrollmentOnboarding" ADD CONSTRAINT "MarketplaceEnrollmentOnboarding_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "MarketplaceEnrollmentIntent"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceEnrollmentEvent" ADD CONSTRAINT "MarketplaceEnrollmentEvent_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "MarketplaceEnrollmentIntent"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceEnrollmentEvent" ADD CONSTRAINT "MarketplaceEnrollmentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


ALTER TABLE "MarketplaceEnrollmentIntent" ADD CONSTRAINT marketplace_intent_ref CHECK ("publicRef" ~ '^[A-Za-z0-9_-]{43}$');
ALTER TABLE "MarketplaceEnrollmentIntent" ADD CONSTRAINT marketplace_intent_quote CHECK ("priceMinor" >= 0 AND "currency" ~ '^[A-Z]{3}$' AND length("titleSnapshot") BETWEEN 1 AND 160 AND length("durationLabel") <= 120);
ALTER TABLE "MarketplaceEnrollmentIntent" ADD CONSTRAINT marketplace_intent_expiry CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + interval '24 hours');
ALTER TABLE "MarketplaceEnrollmentIntent" ADD CONSTRAINT marketplace_intent_identity CHECK (("userId" IS NULL AND "browserHash" IS NOT NULL AND "browserHash" ~ '^[a-f0-9]{64}$' AND "state" IN ('ACCOUNT_REQUIRED','EXPIRED','CANCELLED')) OR ("userId" IS NOT NULL AND "browserHash" IS NULL AND "state" <> 'ACCOUNT_REQUIRED'));
ALTER TABLE "MarketplaceEnrollmentOnboarding" ADD CONSTRAINT marketplace_onboarding_bounds CHECK ("completedStep" BETWEEN 0 AND 3 AND ("fullName" IS NULL OR length("fullName") BETWEEN 2 AND 120) AND ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{7,14}$') AND ("city" IS NULL OR length("city") BETWEEN 2 AND 100) AND ("region" IS NULL OR length("region") BETWEEN 2 AND 100) AND ("country" IS NULL OR length("country") BETWEEN 2 AND 80) AND ("institution" IS NULL OR length("institution") <= 160) AND ("goal" IS NULL OR length("goal") BETWEEN 10 AND 1500) AND ("source" IS NULL OR length("source") <= 200));
ALTER TABLE "MarketplaceEnrollmentOnboarding" ADD CONSTRAINT marketplace_onboarding_values CHECK (("educationLevel" IS NULL OR "educationLevel" IN ('SCHOOL','UNDERGRADUATE','POSTGRADUATE','VOCATIONAL','OTHER')) AND ("currentStatus" IS NULL OR "currentStatus" IN ('SCHOOL_STUDENT','COLLEGE_STUDENT','WORKING_PROFESSIONAL','PARENT_GUARDIAN','OTHER')) AND (("completedAt" IS NULL AND "consentVersion" IS NULL) OR ("completedAt" IS NOT NULL AND "completedStep"=3 AND "consentVersion" IS NOT NULL AND "consentVersion"='enrollment-details-v1')));
ALTER TABLE "MarketplaceEnrollmentEvent" ADD CONSTRAINT marketplace_event_fields CHECK (cardinality("changedFields") <= 12 AND array_position("changedFields",NULL) IS NULL AND "changedFields" <@ ARRAY['offering','quote','account','fullName','phone','city','region','country','educationLevel','currentStatus','institution','goal','source','consent']::text[]);

CREATE FUNCTION protect_marketplace_intent_quote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."offeringId",NEW."publicRef",NEW."titleSnapshot",NEW."priceMinor",NEW."currency",NEW."durationLabel",NEW."deliveryMode",NEW."cohortStartsAt",NEW."expiresAt",NEW."createdAt") IS DISTINCT FROM ROW(OLD."offeringId",OLD."publicRef",OLD."titleSnapshot",OLD."priceMinor",OLD."currency",OLD."durationLabel",OLD."deliveryMode",OLD."cohortStartsAt",OLD."expiresAt",OLD."createdAt") OR (OLD."userId" IS NOT NULL AND NEW."userId" IS DISTINCT FROM OLD."userId") THEN RAISE EXCEPTION 'Enrollment quote and claimed owner are immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER marketplace_intent_quote_immutable BEFORE UPDATE ON "MarketplaceEnrollmentIntent" FOR EACH ROW EXECUTE FUNCTION protect_marketplace_intent_quote();
CREATE FUNCTION reject_marketplace_enrollment_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Enrollment events are immutable'; END;
$$;
CREATE TRIGGER marketplace_enrollment_event_append_only BEFORE UPDATE OR DELETE ON "MarketplaceEnrollmentEvent" FOR EACH ROW EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE TRIGGER marketplace_enrollment_event_no_truncate BEFORE TRUNCATE ON "MarketplaceEnrollmentEvent" FOR EACH STATEMENT EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();

ALTER TABLE "MarketplaceEnrollmentEvent" ALTER COLUMN "changedFields" SET NOT NULL;
CREATE FUNCTION check_marketplace_enrollment_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target TEXT; owner_id TEXT; intent_state TEXT; completed TIMESTAMPTZ; has_onboarding BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'MarketplaceEnrollmentIntent' THEN target := NEW.id; ELSIF TG_OP='DELETE' THEN target := OLD."intentId"; ELSE target := NEW."intentId"; END IF;
  EXECUTE format('SELECT i."userId",i.state,o."completedAt",o."intentId" IS NOT NULL FROM %I."MarketplaceEnrollmentIntent" i LEFT JOIN %I."MarketplaceEnrollmentOnboarding" o ON o."intentId"=i.id WHERE i.id=$1',TG_TABLE_SCHEMA,TG_TABLE_SCHEMA) INTO owner_id,intent_state,completed,has_onboarding USING target;
  IF intent_state='READY_FOR_CHECKOUT' AND completed IS NULL THEN RAISE EXCEPTION 'Checkout requires completed onboarding'; END IF;
  IF has_onboarding AND owner_id IS NULL THEN RAISE EXCEPTION 'Onboarding requires a claimed account'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER marketplace_intent_ready_guard AFTER INSERT OR UPDATE ON "MarketplaceEnrollmentIntent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_marketplace_enrollment_state();
CREATE CONSTRAINT TRIGGER marketplace_onboarding_owner_guard AFTER INSERT OR UPDATE OR DELETE ON "MarketplaceEnrollmentOnboarding" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_marketplace_enrollment_state();
