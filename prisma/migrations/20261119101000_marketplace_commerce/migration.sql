CREATE TYPE "MarketplacePaymentEventKind" AS ENUM ('PAYMENT_UPDATED','REFUND_UPDATED','DISPUTE','IGNORED');

-- CreateEnum
CREATE TYPE "MarketplaceOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'PAID', 'REVIEW', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MarketplacePaymentStatus" AS ENUM ('CREATED', 'CREATING', 'PROVIDER_PENDING', 'AUTHORIZED', 'CAPTURED', 'UNKNOWN', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MarketplacePaymentEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'UNRESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MarketplaceEntitlementStatus" AS ENUM ('ACTIVE', 'REVOKED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MarketplaceCommerceEventKind" AS ENUM ('OrderExpired', 'OrderCreated', 'PaymentAttemptCreated', 'PaymentPending', 'PaymentConfirmed', 'PaymentFailed', 'PaymentReconciled', 'PaymentReviewRequired', 'EntitlementGranted', 'EntitlementRevoked', 'OnboardingRedacted');

-- AlterTable
ALTER TABLE "MarketplaceEnrollmentIntent" ADD COLUMN     "redactedAt" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "subtotalMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "durationLabel" TEXT NOT NULL,
    "deliveryMode" "MarketplaceDeliveryMode" NOT NULL,
    "cohortStartsAt" TIMESTAMPTZ(6),
    "status" "MarketplaceOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "revision" UUID NOT NULL,
    "termsVersion" TEXT,
    "acknowledgedAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "paidAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePaymentAttempt" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "merchantRef" TEXT NOT NULL,
    "providerSessionId" TEXT,
    "providerPaymentId" TEXT,
    "idempotencyKey" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "MarketplacePaymentStatus" NOT NULL DEFAULT 'CREATED',
    "failureCode" TEXT,
    "revision" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MarketplacePaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePaymentEvent" (
    "kind" "MarketplacePaymentEventKind" NOT NULL,
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "merchantRef" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "providerSessionId" TEXT,
    "providerPaymentId" TEXT,
    "payloadDigest" TEXT NOT NULL,
    "status" "MarketplacePaymentEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "safeCode" TEXT,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(6),

    CONSTRAINT "MarketplacePaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "MarketplaceEntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MarketplaceEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCommerceEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "intentId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" "MarketplaceCommerceEventKind" NOT NULL,
    "safeCode" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCommerceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_publicRef_key" ON "MarketplaceOrder"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_intentId_key" ON "MarketplaceOrder"("intentId");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_userId_createdAt_idx" ON "MarketplaceOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_status_createdAt_idx" ON "MarketplaceOrder"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePaymentAttempt_publicRef_key" ON "MarketplacePaymentAttempt"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePaymentAttempt_orderId_key" ON "MarketplacePaymentAttempt"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePaymentAttempt_idempotencyKey_key" ON "MarketplacePaymentAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketplacePaymentAttempt_status_updatedAt_idx" ON "MarketplacePaymentAttempt"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePaymentAttempt_provider_merchantRef_providerSess_key" ON "MarketplacePaymentAttempt"("provider", "merchantRef", "providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePaymentAttempt_provider_merchantRef_providerPaym_key" ON "MarketplacePaymentAttempt"("provider", "merchantRef", "providerPaymentId");

-- CreateIndex
CREATE INDEX "MarketplacePaymentEvent_status_receivedAt_idx" ON "MarketplacePaymentEvent"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "MarketplacePaymentEvent_provider_merchantRef_providerSessio_idx" ON "MarketplacePaymentEvent"("provider", "merchantRef", "providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePaymentEvent_provider_merchantRef_providerEventI_key" ON "MarketplacePaymentEvent"("provider", "merchantRef", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceEntitlement_orderId_key" ON "MarketplaceEntitlement"("orderId");

-- CreateIndex
CREATE INDEX "MarketplaceEntitlement_userId_offeringId_status_idx" ON "MarketplaceEntitlement"("userId", "offeringId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceCommerceEvent_orderId_createdAt_idx" ON "MarketplaceCommerceEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceCommerceEvent_intentId_createdAt_idx" ON "MarketplaceCommerceEvent"("intentId", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "MarketplaceEnrollmentIntent"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "MarketplaceOffering"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplacePaymentAttempt" ADD CONSTRAINT "MarketplacePaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceEntitlement" ADD CONSTRAINT "MarketplaceEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceEntitlement" ADD CONSTRAINT "MarketplaceEntitlement_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "MarketplaceOffering"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceEntitlement" ADD CONSTRAINT "MarketplaceEntitlement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceCommerceEvent" ADD CONSTRAINT "MarketplaceCommerceEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceCommerceEvent" ADD CONSTRAINT "MarketplaceCommerceEvent_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "MarketplaceEnrollmentIntent"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "MarketplaceCommerceEvent" ADD CONSTRAINT "MarketplaceCommerceEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Preserve permission-set uniqueness/null invariants while adding two financial capabilities.
CREATE OR REPLACE FUNCTION valid_admin_permissions(p "AdminPermission"[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT p IS NOT NULL AND cardinality(p)<=15 AND (cardinality(p)=0 OR array_ndims(p)=1)
 AND NOT EXISTS(SELECT 1 FROM unnest(p) v WHERE v IS NULL)
 AND cardinality(p)=(SELECT count(DISTINCT v) FROM unnest(p) v);
$$;
CREATE UNIQUE INDEX marketplace_one_open_order ON "MarketplaceOrder"("userId","offeringId") WHERE status IN ('PENDING_PAYMENT','PAYMENT_PROCESSING','REVIEW','REFUND_PENDING');
CREATE UNIQUE INDEX marketplace_one_active_entitlement ON "MarketplaceEntitlement"("userId","offeringId") WHERE status='ACTIVE';
CREATE UNIQUE INDEX marketplace_payment_event_digest ON "MarketplacePaymentEvent"(provider,"merchantRef","payloadDigest");
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT marketplace_order_bounds CHECK ("publicRef" ~ '^[A-Za-z0-9_-]{43}$' AND "subtotalMinor">=0 AND "totalMinor"="subtotalMinor" AND currency ~ '^[A-Z]{3}$' AND length("titleSnapshot") BETWEEN 1 AND 160 AND length("durationLabel") BETWEEN 1 AND 120 AND "expiresAt">"createdAt" AND (("termsVersion" IS NULL AND "acknowledgedAt" IS NULL) OR ("termsVersion" IS NOT NULL AND length("termsVersion") BETWEEN 1 AND 100 AND "acknowledgedAt" IS NOT NULL)) AND (status<>'PAID' OR ("paidAt" IS NOT NULL AND "termsVersion" IS NOT NULL AND "acknowledgedAt" IS NOT NULL)));
ALTER TABLE "MarketplacePaymentAttempt" ADD CONSTRAINT marketplace_attempt_bounds CHECK ("publicRef" ~ '^[A-Za-z0-9_-]{43}$' AND provider ~ '^[A-Z][A-Z0-9_]{0,31}$' AND "merchantRef" ~ '^[A-Za-z0-9_-]{1,100}$' AND "amountMinor">=0 AND currency ~ '^[A-Z]{3}$' AND ("providerSessionId" IS NULL OR "providerSessionId" ~ '^[A-Za-z0-9_-]{1,100}$') AND ("providerPaymentId" IS NULL OR "providerPaymentId" ~ '^[A-Za-z0-9_-]{1,100}$') AND ("failureCode" IS NULL OR "failureCode" ~ '^[A-Z_]{1,64}$') AND (status NOT IN ('CAPTURED','REFUNDED') OR ("providerPaymentId" IS NOT NULL AND "providerSessionId" IS NOT NULL)));
ALTER TABLE "MarketplacePaymentEvent" ADD CONSTRAINT marketplace_payment_event_bounds CHECK (provider ~ '^[A-Z][A-Z0-9_]{0,31}$' AND "merchantRef" ~ '^[A-Za-z0-9_-]{1,100}$' AND "providerEventId" ~ '^[A-Za-z0-9_-]{1,100}$' AND "eventType" ~ '^[A-Za-z0-9_.:-]{1,100}$' AND "payloadDigest" ~ '^[a-f0-9]{64}$' AND ("safeCode" IS NULL OR "safeCode" ~ '^[A-Z_]{1,64}$') AND ((status IN ('PROCESSED','REJECTED') AND "processedAt" IS NOT NULL) OR (status IN ('RECEIVED','UNRESOLVED') AND "processedAt" IS NULL)));
ALTER TABLE "MarketplaceEntitlement" ADD CONSTRAINT marketplace_entitlement_revocation CHECK ((status='ACTIVE' AND "revokedAt" IS NULL) OR (status<>'ACTIVE' AND "revokedAt" IS NOT NULL));
ALTER TABLE "MarketplaceCommerceEvent" ADD CONSTRAINT marketplace_commerce_audit_code CHECK ("safeCode" IS NULL OR "safeCode" ~ '^[A-Z_]{1,64}$');
CREATE FUNCTION protect_marketplace_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source RECORD; completed TIMESTAMPTZ;
BEGIN
 IF TG_OP='INSERT' THEN
  EXECUTE format('SELECT * FROM %I."MarketplaceEnrollmentIntent" WHERE id=$1',TG_TABLE_SCHEMA) INTO source USING NEW."intentId";
  EXECUTE format('SELECT "completedAt" FROM %I."MarketplaceEnrollmentOnboarding" WHERE "intentId"=$1',TG_TABLE_SCHEMA) INTO completed USING NEW."intentId";
  IF source."userId" IS NULL OR source.state::text<>'READY_FOR_CHECKOUT' OR completed IS NULL OR ROW(NEW."userId",NEW."offeringId",NEW."titleSnapshot",NEW."subtotalMinor",NEW.currency,NEW."durationLabel",NEW."deliveryMode",NEW."cohortStartsAt",NEW."expiresAt") IS DISTINCT FROM ROW(source."userId",source."offeringId",source."titleSnapshot",source."priceMinor",source.currency,source."durationLabel",source."deliveryMode",source."cohortStartsAt",source."expiresAt") THEN RAISE EXCEPTION 'Order must match an owned ready commercial quote'; END IF;
 ELSIF ROW(NEW."intentId",NEW."publicRef",NEW."userId",NEW."offeringId",NEW."titleSnapshot",NEW."subtotalMinor",NEW."totalMinor",NEW.currency,NEW."durationLabel",NEW."deliveryMode",NEW."cohortStartsAt",NEW."termsVersion",NEW."acknowledgedAt",NEW."expiresAt",NEW."createdAt") IS DISTINCT FROM ROW(OLD."intentId",OLD."publicRef",OLD."userId",OLD."offeringId",OLD."titleSnapshot",OLD."subtotalMinor",OLD."totalMinor",OLD.currency,OLD."durationLabel",OLD."deliveryMode",OLD."cohortStartsAt",OLD."termsVersion",OLD."acknowledgedAt",OLD."expiresAt",OLD."createdAt") THEN RAISE EXCEPTION 'Order commercial commitment is immutable';
 END IF;
 IF TG_OP='UPDATE' AND ((OLD.status='PAID' AND NEW.status NOT IN ('PAID','REFUND_PENDING','REFUNDED')) OR (OLD.status='REFUNDED' AND NEW.status<>'REFUNDED') OR (OLD.status='REFUND_PENDING' AND NEW.status NOT IN ('REFUND_PENDING','REFUNDED'))) THEN RAISE EXCEPTION 'Settlement cannot be downgraded'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER marketplace_order_immutable BEFORE INSERT OR UPDATE ON "MarketplaceOrder" FOR EACH ROW EXECUTE FUNCTION protect_marketplace_order();
CREATE FUNCTION protect_marketplace_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."orderId",NEW."publicRef",NEW.provider,NEW."merchantRef",NEW."idempotencyKey",NEW."amountMinor",NEW.currency,NEW."createdAt") IS DISTINCT FROM ROW(OLD."orderId",OLD."publicRef",OLD.provider,OLD."merchantRef",OLD."idempotencyKey",OLD."amountMinor",OLD.currency,OLD."createdAt") OR (OLD."providerSessionId" IS NOT NULL AND NEW."providerSessionId" IS DISTINCT FROM OLD."providerSessionId") OR (OLD."providerPaymentId" IS NOT NULL AND NEW."providerPaymentId" IS DISTINCT FROM OLD."providerPaymentId") OR (OLD.status='CAPTURED' AND NEW.status NOT IN ('CAPTURED','REFUNDED')) OR (OLD.status='REFUNDED' AND NEW.status<>'REFUNDED') THEN RAISE EXCEPTION 'Provider identity and settlement are immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER marketplace_attempt_immutable BEFORE UPDATE ON "MarketplacePaymentAttempt" FOR EACH ROW EXECUTE FUNCTION protect_marketplace_attempt();
CREATE FUNCTION check_marketplace_settlement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target TEXT; o RECORD; a RECORD; e RECORD;
BEGIN
 IF TG_TABLE_NAME='MarketplaceOrder' THEN target:=NEW.id; ELSIF TG_OP='DELETE' THEN target:=OLD."orderId"; ELSE target:=NEW."orderId"; END IF;
 EXECUTE format('SELECT * FROM %I."MarketplaceOrder" WHERE id=$1',TG_TABLE_SCHEMA) INTO o USING target;
 EXECUTE format('SELECT * FROM %I."MarketplacePaymentAttempt" WHERE "orderId"=$1',TG_TABLE_SCHEMA) INTO a USING target;
 EXECUTE format('SELECT * FROM %I."MarketplaceEntitlement" WHERE "orderId"=$1',TG_TABLE_SCHEMA) INTO e USING target;
 IF a.id IS NOT NULL AND (a."amountMinor"<>o."totalMinor" OR a.currency<>o.currency) THEN RAISE EXCEPTION 'Attempt must match its commercial commitment'; END IF;
 IF e.id IS NOT NULL AND (e."userId"<>o."userId" OR e."offeringId"<>o."offeringId") THEN RAISE EXCEPTION 'Entitlement ownership mismatch'; END IF;
 IF o.status='PAID' AND (a.id IS NULL OR a.status<>'CAPTURED' OR a."providerPaymentId" IS NULL OR e.id IS NULL OR e.status<>'ACTIVE') THEN RAISE EXCEPTION 'Paid order requires captured attempt and entitlement'; END IF;
 IF e.id IS NOT NULL AND e.status='ACTIVE' AND (o.status<>'PAID' OR a.id IS NULL OR a.status<>'CAPTURED') THEN RAISE EXCEPTION 'Entitlement requires settled payment'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER marketplace_settlement_order AFTER INSERT OR UPDATE ON "MarketplaceOrder" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_marketplace_settlement();
CREATE CONSTRAINT TRIGGER marketplace_settlement_attempt AFTER INSERT OR UPDATE OR DELETE ON "MarketplacePaymentAttempt" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_marketplace_settlement();
CREATE CONSTRAINT TRIGGER marketplace_settlement_entitlement AFTER INSERT OR UPDATE OR DELETE ON "MarketplaceEntitlement" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_marketplace_settlement();
CREATE TRIGGER marketplace_commerce_audit_append_only BEFORE UPDATE OR DELETE ON "MarketplaceCommerceEvent" FOR EACH ROW EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE TRIGGER marketplace_commerce_audit_no_truncate BEFORE TRUNCATE ON "MarketplaceCommerceEvent" FOR EACH STATEMENT EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE FUNCTION protect_marketplace_payment_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.kind,NEW.provider,NEW."merchantRef",NEW."providerEventId",NEW."payloadDigest",NEW."eventType",NEW."providerSessionId",NEW."providerPaymentId",NEW."receivedAt") IS DISTINCT FROM ROW(OLD.kind,OLD.provider,OLD."merchantRef",OLD."providerEventId",OLD."payloadDigest",OLD."eventType",OLD."providerSessionId",OLD."providerPaymentId",OLD."receivedAt") THEN RAISE EXCEPTION 'Provider event evidence is immutable'; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER marketplace_payment_event_immutable BEFORE UPDATE ON "MarketplacePaymentEvent" FOR EACH ROW EXECUTE FUNCTION protect_marketplace_payment_event();
CREATE FUNCTION protect_marketplace_entitlement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."orderId",NEW."userId",NEW."offeringId",NEW."grantedAt",NEW."createdAt") IS DISTINCT FROM ROW(OLD."orderId",OLD."userId",OLD."offeringId",OLD."grantedAt",OLD."createdAt") OR (OLD.status<>'ACTIVE' AND NEW.status='ACTIVE') OR (OLD.status='REFUNDED' AND NEW.status<>'REFUNDED') THEN RAISE EXCEPTION 'Entitlement identity and revocation are immutable'; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER marketplace_entitlement_identity BEFORE UPDATE ON "MarketplaceEntitlement" FOR EACH ROW EXECUTE FUNCTION protect_marketplace_entitlement();
CREATE TRIGGER marketplace_order_no_delete BEFORE DELETE ON "MarketplaceOrder" FOR EACH ROW EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE TRIGGER marketplace_attempt_no_delete BEFORE DELETE ON "MarketplacePaymentAttempt" FOR EACH ROW EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE TRIGGER marketplace_entitlement_no_delete BEFORE DELETE ON "MarketplaceEntitlement" FOR EACH ROW EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE TRIGGER marketplace_payment_event_no_delete BEFORE DELETE ON "MarketplacePaymentEvent" FOR EACH ROW EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE TRIGGER marketplace_order_no_truncate BEFORE TRUNCATE ON "MarketplaceOrder" FOR EACH STATEMENT EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE TRIGGER marketplace_attempt_no_truncate BEFORE TRUNCATE ON "MarketplacePaymentAttempt" FOR EACH STATEMENT EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE TRIGGER marketplace_entitlement_no_truncate BEFORE TRUNCATE ON "MarketplaceEntitlement" FOR EACH STATEMENT EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
CREATE TRIGGER marketplace_payment_event_no_truncate BEFORE TRUNCATE ON "MarketplacePaymentEvent" FOR EACH STATEMENT EXECUTE FUNCTION reject_marketplace_enrollment_event_mutation();
