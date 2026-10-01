-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_TEXT', 'LONG_TEXT');

-- CreateEnum
CREATE TYPE "AcademicAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "SubmissionKind" AS ENUM ('TEXT', 'FILE', 'TEXT_AND_FILE');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'HELD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "academicCompletionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "certificateEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requiredAttendancePercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "completedAt" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "QuestionBank" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "QuestionBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "position" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicActivity" (
    "itemId" TEXT NOT NULL,
    "itemType" "LearningItemType" NOT NULL,
    "instructions" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "passingPercent" DOUBLE PRECISION,
    "attemptLimit" INTEGER,
    "reviewAnswers" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AcademicActivity_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "ActivityQuestion" (
    "activityId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ActivityQuestion_pkey" PRIMARY KEY ("activityId","questionId")
);

-- CreateTable
CREATE TABLE "AcademicAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "AcademicAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSavedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMPTZ(6),
    "score" INTEGER,
    "maxScore" INTEGER,
    "percentage" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "passingPercent" DOUBLE PRECISION,
    "reviewAnswers" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AcademicAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicResponse" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "position" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "text" TEXT,
    "awardedPoints" INTEGER,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AcademicResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseOption" (
    "responseId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResponseOption_pkey" PRIMARY KEY ("responseId","optionId")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "itemId" TEXT NOT NULL,
    "itemType" "LearningItemType" NOT NULL DEFAULT 'ASSIGNMENT',
    "instructions" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMPTZ(6),
    "allowedKinds" "SubmissionKind"[],
    "maxFiles" INTEGER NOT NULL DEFAULT 3,
    "maxFileBytes" INTEGER NOT NULL DEFAULT 5242880,
    "requiresAcceptance" BOOLEAN NOT NULL DEFAULT true,
    "allowResubmission" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionVersion" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "requestKey" TEXT NOT NULL,
    "submittedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "SubmissionKind" NOT NULL,
    "text" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',

    CONSTRAINT "SubmissionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionFile" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,

    CONSTRAINT "SubmissionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentReview" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL,
    "feedback" TEXT NOT NULL,
    "reviewedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchSession" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(6) NOT NULL,
    "endsAt" TIMESTAMPTZ(6) NOT NULL,
    "courseId" TEXT,
    "itemId" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "locationLabel" TEXT,
    "externalTargetId" TEXT,

    CONSTRAINT "BatchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "sessionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CertificateStatus" NOT NULL DEFAULT 'ACTIVE',
    "storageKey" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Question_bankId_position_key" ON "Question"("bankId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_position_key" ON "QuestionOption"("questionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicActivity_itemId_itemType_key" ON "AcademicActivity"("itemId", "itemType");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityQuestion_activityId_position_key" ON "ActivityQuestion"("activityId", "position");

-- CreateIndex
CREATE INDEX "AcademicAttempt_userId_activityId_status_idx" ON "AcademicAttempt"("userId", "activityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicAttempt_userId_activityId_number_key" ON "AcademicAttempt"("userId", "activityId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicResponse_attemptId_questionId_key" ON "AcademicResponse"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicResponse_attemptId_position_key" ON "AcademicResponse"("attemptId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseOption_responseId_position_key" ON "ResponseOption"("responseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_itemId_itemType_key" ON "Assignment"("itemId", "itemType");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_userId_assignmentId_key" ON "AssignmentSubmission"("userId", "assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionVersion_submissionId_number_key" ON "SubmissionVersion"("submissionId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionVersion_submissionId_requestKey_key" ON "SubmissionVersion"("submissionId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionFile_storageKey_key" ON "SubmissionFile"("storageKey");

-- CreateIndex
CREATE INDEX "AssignmentReview_versionId_reviewedAt_idx" ON "AssignmentReview"("versionId", "reviewedAt");

-- CreateIndex
CREATE INDEX "BatchSession_batchId_startsAt_idx" ON "BatchSession"("batchId", "startsAt");

-- CreateIndex
CREATE INDEX "AttendanceRecord_userId_idx" ON "AttendanceRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_code_key" ON "Certificate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_userId_courseId_key" ON "Certificate"("userId", "courseId");

-- CreateIndex
CREATE INDEX "AcademicAudit_targetId_createdAt_idx" ON "AcademicAudit"("targetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BatchMembership_id_userId_key" ON "BatchMembership"("id", "userId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "QuestionBank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicActivity" ADD CONSTRAINT "AcademicActivity_itemId_itemType_fkey" FOREIGN KEY ("itemId", "itemType") REFERENCES "LearningItem"("id", "type") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ActivityQuestion" ADD CONSTRAINT "ActivityQuestion_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "AcademicActivity"("itemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityQuestion" ADD CONSTRAINT "ActivityQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAttempt" ADD CONSTRAINT "AcademicAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAttempt" ADD CONSTRAINT "AcademicAttempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "AcademicActivity"("itemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicResponse" ADD CONSTRAINT "AcademicResponse_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AcademicAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseOption" ADD CONSTRAINT "ResponseOption_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AcademicResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_itemId_itemType_fkey" FOREIGN KEY ("itemId", "itemType") REFERENCES "LearningItem"("id", "type") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("itemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionVersion" ADD CONSTRAINT "SubmissionVersion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionFile" ADD CONSTRAINT "SubmissionFile_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SubmissionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentReview" ADD CONSTRAINT "AssignmentReview_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "SubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentReview" ADD CONSTRAINT "AssignmentReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchSession" ADD CONSTRAINT "BatchSession_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchSession" ADD CONSTRAINT "BatchSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchSession" ADD CONSTRAINT "BatchSession_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LearningItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BatchSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_membershipId_userId_fkey" FOREIGN KEY ("membershipId", "userId") REFERENCES "BatchMembership"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicAudit" ADD CONSTRAINT "AcademicAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Course" ADD CONSTRAINT "course_attendance_percent" CHECK ("requiredAttendancePercent" IS NULL OR "requiredAttendancePercent" BETWEEN 0 AND 100);
ALTER TABLE "AcademicActivity" ADD CONSTRAINT "activity_kind" CHECK ("itemType" IN ('QUIZ','ASSESSMENT')), ADD CONSTRAINT "activity_policy" CHECK (("passingPercent" IS NULL OR "passingPercent" BETWEEN 0 AND 100) AND ("attemptLimit" IS NULL OR "attemptLimit" BETWEEN 1 AND 100));
ALTER TABLE "Assignment" ADD CONSTRAINT "assignment_kind" CHECK ("itemType" = 'ASSIGNMENT'), ADD CONSTRAINT "assignment_file_policy" CHECK ("maxFiles" BETWEEN 0 AND 5 AND "maxFileBytes" BETWEEN 1 AND 10485760 AND cardinality("allowedKinds") BETWEEN 1 AND 3);
ALTER TABLE "Question" ADD CONSTRAINT "question_position" CHECK ("position" > 0 AND length("prompt") BETWEEN 1 AND 12000);
ALTER TABLE "QuestionOption" ADD CONSTRAINT "option_position" CHECK ("position" > 0 AND length("label") BETWEEN 1 AND 2000);
ALTER TABLE "ActivityQuestion" ADD CONSTRAINT "activity_question_points" CHECK ("position" > 0 AND "points" BETWEEN 1 AND 1000);
ALTER TABLE "AcademicAttempt" ADD CONSTRAINT "attempt_dates" CHECK ("number" > 0 AND "lastSavedAt" >= "startedAt" AND ("submittedAt" IS NULL OR "submittedAt" >= "startedAt")), ADD CONSTRAINT "attempt_lifecycle" CHECK (("status" = 'IN_PROGRESS' AND "submittedAt" IS NULL AND "score" IS NULL AND "maxScore" IS NULL AND "percentage" IS NULL AND "passed" IS NULL) OR ("status" = 'SUBMITTED' AND "submittedAt" IS NOT NULL AND "score" >= 0 AND "maxScore" > 0 AND "score" <= "maxScore" AND "percentage" BETWEEN 0 AND 100));
CREATE UNIQUE INDEX "one_open_attempt" ON "AcademicAttempt"("userId","activityId") WHERE "status" = 'IN_PROGRESS';
ALTER TABLE "AcademicResponse" ADD CONSTRAINT "response_bounds" CHECK ("position" > 0 AND "points" BETWEEN 1 AND 1000 AND ("text" IS NULL OR length("text") <= 12000) AND ("awardedPoints" IS NULL OR "awardedPoints" BETWEEN 0 AND "points"));
ALTER TABLE "SubmissionVersion" ADD CONSTRAINT "submission_bounds" CHECK ("number" > 0 AND ("text" IS NULL OR length("text") <= 12000));
ALTER TABLE "SubmissionFile" ADD CONSTRAINT "submission_file_size" CHECK ("bytes" BETWEEN 1 AND 10485760 AND "mimeType" IN ('application/pdf','image/png','image/jpeg','image/webp','image/gif','text/plain'));
ALTER TABLE "BatchSession" ADD CONSTRAINT "session_dates" CHECK ("endsAt" > "startsAt");
-- Preserve submitted answer/scoring snapshots and historical submission content at the database boundary.
CREATE FUNCTION academic_response_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE submitted boolean;
BEGIN
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I."AcademicAttempt" WHERE id = $1 AND status = ''SUBMITTED'')',TG_TABLE_SCHEMA) INTO submitted USING OLD."attemptId";
  IF submitted THEN RAISE EXCEPTION 'Submitted responses are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER academic_response_immutable BEFORE UPDATE ON "AcademicResponse" FOR EACH ROW EXECUTE FUNCTION academic_response_immutable();
CREATE FUNCTION response_option_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE submitted boolean;
BEGIN
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I."AcademicResponse" r JOIN %I."AcademicAttempt" a ON a.id = r."attemptId" WHERE r.id = $1 AND a.status = ''SUBMITTED'')',TG_TABLE_SCHEMA,TG_TABLE_SCHEMA) INTO submitted USING OLD."responseId";
  IF submitted THEN RAISE EXCEPTION 'Submitted options are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER response_option_immutable BEFORE UPDATE ON "ResponseOption" FOR EACH ROW EXECUTE FUNCTION response_option_immutable();
CREATE FUNCTION submission_content_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."submissionId",NEW.number,NEW."requestKey",NEW."submittedAt",NEW.kind,NEW.text) IS DISTINCT FROM (OLD."submissionId",OLD.number,OLD."requestKey",OLD."submittedAt",OLD.kind,OLD.text) THEN RAISE EXCEPTION 'Submission content is immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER submission_content_immutable BEFORE UPDATE ON "SubmissionVersion" FOR EACH ROW EXECUTE FUNCTION submission_content_immutable();
CREATE FUNCTION attendance_membership_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE valid boolean;
BEGIN
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I."BatchSession" s JOIN %I."BatchMembership" m ON m."batchId" = s."batchId" WHERE s.id = $1 AND m.id = $2 AND m."userId" = $3 AND m."joinedAt" <= s."startsAt" AND (m."leftAt" IS NULL OR m."leftAt" > s."startsAt"))',TG_TABLE_SCHEMA,TG_TABLE_SCHEMA) INTO valid USING NEW."sessionId",NEW."membershipId",NEW."userId";
  IF NOT valid THEN RAISE EXCEPTION 'Attendance membership scope invalid'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_membership_scope BEFORE INSERT OR UPDATE ON "AttendanceRecord" FOR EACH ROW EXECUTE FUNCTION attendance_membership_scope();
