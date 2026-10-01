-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'IN_APP');

-- CreateEnum
CREATE TYPE "CommunicationPurpose" AS ENUM ('OPERATIONAL', 'MARKETING');

-- CreateEnum
CREATE TYPE "CommunicationDeliveryStatus" AS ENUM ('PENDING_PROVIDER', 'SUPPRESSED');

-- CreateTable
CREATE TABLE "CommunicationPreference" (
    "userId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "purpose" "CommunicationPurpose" NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "evidence" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationPreference_pkey" PRIMARY KEY ("userId","channel","purpose")
);

-- CreateTable
CREATE TABLE "CommunicationMessage" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "purpose" "CommunicationPurpose" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationDelivery" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CommunicationDeliveryStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "queuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationDelivery_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateTable
CREATE TABLE "DiscussionThread" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "batchId" TEXT,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionPost" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "courseId" TEXT,
    "userId" TEXT,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationMessage_batchId_createdAt_idx" ON "CommunicationMessage"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationDelivery_userId_queuedAt_idx" ON "CommunicationDelivery"("userId", "queuedAt");

-- CreateIndex
CREATE INDEX "DiscussionThread_courseId_updatedAt_idx" ON "DiscussionThread"("courseId", "updatedAt");

-- CreateIndex
CREATE INDEX "DiscussionThread_batchId_updatedAt_idx" ON "DiscussionThread"("batchId", "updatedAt");

-- CreateIndex
CREATE INDEX "DiscussionPost_threadId_createdAt_id_idx" ON "DiscussionPost"("threadId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LearningEvent_key_key" ON "LearningEvent"("key");

-- CreateIndex
CREATE INDEX "LearningEvent_kind_occurredAt_idx" ON "LearningEvent"("kind", "occurredAt");

-- AddForeignKey
ALTER TABLE "CommunicationPreference" ADD CONSTRAINT "CommunicationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommunicationMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionPost" ADD CONSTRAINT "DiscussionPost_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DiscussionThread"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionPost" ADD CONSTRAINT "DiscussionPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Bound plaintext and prevent accidental identity/context reassignment in future privileged work.
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "discussion_title_length" CHECK (length(btrim("title")) BETWEEN 3 AND 160);
ALTER TABLE "DiscussionPost" ADD CONSTRAINT "discussion_body_length" CHECK (length(btrim("body")) BETWEEN 1 AND 6000);
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "communication_text_length" CHECK (length(btrim("subject")) BETWEEN 1 AND 160 AND length(btrim("body")) BETWEEN 1 AND 6000);
ALTER TABLE "CommunicationPreference" ADD CONSTRAINT "consent_evidence_length" CHECK (length(btrim("evidence")) BETWEEN 1 AND 500);
CREATE FUNCTION "protect_discussion_context"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."courseId" IS DISTINCT FROM OLD."courseId" OR NEW."batchId" IS DISTINCT FROM OLD."batchId" OR NEW."authorId" IS DISTINCT FROM OLD."authorId") THEN
    RAISE EXCEPTION 'Discussion context is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "discussion_context_immutable" BEFORE UPDATE ON "DiscussionThread" FOR EACH ROW EXECUTE FUNCTION "protect_discussion_context"();
CREATE FUNCTION "protect_discussion_post"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Discussion posts are immutable';
END $$;
CREATE TRIGGER "discussion_post_immutable" BEFORE UPDATE ON "DiscussionPost" FOR EACH ROW EXECUTE FUNCTION "protect_discussion_post"();
-- Home recent-result reads and per-course result history.
CREATE INDEX "AcademicAttempt_userId_submittedAt_idx" ON "AcademicAttempt"("userId", "submittedAt" DESC);

ALTER TABLE "AcademicAudit" ADD COLUMN "details" JSONB;
