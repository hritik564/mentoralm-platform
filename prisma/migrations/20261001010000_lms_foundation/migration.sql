-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LearningItemType" AS ENUM ('LESSON', 'QUIZ', 'ASSIGNMENT', 'RESOURCE', 'LIVE_SESSION', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "LessonFormat" AS ENUM ('VIDEO', 'TEXT', 'PDF', 'IMAGE', 'EXTERNAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "studentId" TEXT;

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "programId" TEXT,
    "courseId" TEXT,
    "startsAt" TIMESTAMPTZ(6),
    "endsAt" TIMESTAMPTZ(6),
    "status" "BatchStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchMembership" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentRole" "Role" NOT NULL DEFAULT 'STUDENT',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchInstructor" (
    "batchId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "instructorRole" "Role" NOT NULL DEFAULT 'INSTRUCTOR',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchInstructor_pkey" PRIMARY KEY ("batchId","instructorId")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "LearningItemType" NOT NULL,
    "position" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LearningItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "itemId" TEXT NOT NULL,
    "itemType" "LearningItemType" NOT NULL DEFAULT 'LESSON',
    "format" "LessonFormat" NOT NULL,
    "storageKey" TEXT,
    "durationSeconds" INTEGER,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("itemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Batch_code_key" ON "Batch"("code");

-- CreateIndex
CREATE INDEX "Batch_programId_idx" ON "Batch"("programId");

-- CreateIndex
CREATE INDEX "Batch_courseId_idx" ON "Batch"("courseId");

-- CreateIndex
CREATE INDEX "Batch_status_startsAt_idx" ON "Batch"("status", "startsAt");

-- CreateIndex
CREATE INDEX "BatchMembership_userId_status_idx" ON "BatchMembership"("userId", "status");

-- CreateIndex
CREATE INDEX "BatchMembership_batchId_status_idx" ON "BatchMembership"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BatchMembership_userId_batchId_key" ON "BatchMembership"("userId", "batchId");

-- CreateIndex
CREATE INDEX "BatchInstructor_instructorId_idx" ON "BatchInstructor"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_courseId_position_key" ON "Section"("courseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LearningItem_sectionId_position_key" ON "LearningItem"("sectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LearningItem_id_type_key" ON "LearningItem"("id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_itemId_itemType_key" ON "Lesson"("itemId", "itemType");

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_role_key" ON "User"("id", "role");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMembership" ADD CONSTRAINT "BatchMembership_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchMembership" ADD CONSTRAINT "BatchMembership_userId_studentRole_fkey" FOREIGN KEY ("userId", "studentRole") REFERENCES "User"("id", "role") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BatchInstructor" ADD CONSTRAINT "BatchInstructor_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchInstructor" ADD CONSTRAINT "BatchInstructor_instructorId_instructorRole_fkey" FOREIGN KEY ("instructorId", "instructorRole") REFERENCES "User"("id", "role") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningItem" ADD CONSTRAINT "LearningItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_itemId_itemType_fkey" FOREIGN KEY ("itemId", "itemType") REFERENCES "LearningItem"("id", "type") ON DELETE CASCADE ON UPDATE RESTRICT;


-- Student-facing identifiers are allocated by PostgreSQL, never by request input.
CREATE SEQUENCE "student_id_seq" AS bigint;
CREATE FUNCTION issue_student_id() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE serial_value text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."studentId" IS NOT NULL AND NEW."studentId" IS DISTINCT FROM OLD."studentId" THEN
    RAISE EXCEPTION 'Student identifier is immutable';
  END IF;
  IF TG_OP = 'INSERT' AND NEW."studentId" IS NOT NULL THEN
    RAISE EXCEPTION 'Student identifier must be generated';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."studentId" IS NULL AND NEW."studentId" IS NOT NULL THEN
    RAISE EXCEPTION 'Student identifier must be generated';
  END IF;
  IF NEW."role" = 'STUDENT' AND NEW."studentId" IS NULL THEN
    serial_value := nextval(format('%I.%I', TG_TABLE_SCHEMA, 'student_id_seq')::regclass)::text;
    NEW."studentId" := 'MLM-STU-' || to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY') || '-' ||
      CASE WHEN length(serial_value) < 6 THEN lpad(serial_value, 6, '0') ELSE serial_value END;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "user_student_id" BEFORE INSERT OR UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION issue_student_id();
-- Non-destructive backfill. Existing IDs and primary keys are preserved.
UPDATE "User" SET "studentId" = NULL WHERE "role" = 'STUDENT' AND "studentId" IS NULL;
ALTER TABLE "User" ADD CONSTRAINT "student_id_required" CHECK ("role" <> 'STUDENT' OR "studentId" IS NOT NULL);
ALTER TABLE "User" ADD CONSTRAINT "student_id_format" CHECK ("studentId" IS NULL OR "studentId" ~ '^MLM-STU-[0-9]{4}-[0-9]{6,}$');
ALTER TABLE "Batch" ADD CONSTRAINT "batch_scope" CHECK (num_nonnulls("programId", "courseId") <= 1);
ALTER TABLE "Batch" ADD CONSTRAINT "batch_dates" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" >= "startsAt");
ALTER TABLE "Batch" ADD CONSTRAINT "batch_code_format" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{2,47}$');
ALTER TABLE "BatchMembership" ADD CONSTRAINT "membership_student" CHECK ("studentRole" = 'STUDENT');
ALTER TABLE "BatchInstructor" ADD CONSTRAINT "assignment_instructor" CHECK ("instructorRole" = 'INSTRUCTOR');
ALTER TABLE "Section" ADD CONSTRAINT "section_position" CHECK ("position" > 0);
ALTER TABLE "LearningItem" ADD CONSTRAINT "item_position" CHECK ("position" > 0);
ALTER TABLE "Lesson" ADD CONSTRAINT "lesson_type" CHECK ("itemType" = 'LESSON');
ALTER TABLE "Lesson" ADD CONSTRAINT "lesson_duration" CHECK ("durationSeconds" IS NULL OR "durationSeconds" >= 0);
