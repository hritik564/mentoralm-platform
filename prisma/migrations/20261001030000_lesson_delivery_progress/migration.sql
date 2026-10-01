-- AlterTable
ALTER TABLE "LearningItem" ADD COLUMN     "required" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "altText" TEXT,
ADD COLUMN     "captionsStorageKey" TEXT,
ADD COLUMN     "downloadAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "externalTargetId" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "structuredContent" JSONB;

-- CreateTable
CREATE TABLE "LessonState" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "firstAccessedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "LessonState_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateTable
CREATE TABLE "LearningResource" (
    "itemId" TEXT NOT NULL,
    "itemType" "LearningItemType" NOT NULL DEFAULT 'RESOURCE',
    "description" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "downloadAllowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("itemId")
);

-- CreateIndex
CREATE INDEX "LessonState_userId_lastAccessedAt_idx" ON "LessonState"("userId", "lastAccessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningResource_itemId_itemType_key" ON "LearningResource"("itemId", "itemType");

-- AddForeignKey
ALTER TABLE "LessonState" ADD CONSTRAINT "LessonState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonState" ADD CONSTRAINT "LessonState_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Lesson"("itemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_itemId_itemType_fkey" FOREIGN KEY ("itemId", "itemType") REFERENCES "LearningItem"("id", "type") ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE "LearningResource" ADD CONSTRAINT "learning_resource_type" CHECK ("itemType" = 'RESOURCE');
ALTER TABLE "LessonState" ADD CONSTRAINT "lesson_state_dates" CHECK ("lastAccessedAt" >= "firstAccessedAt" AND ("completedAt" IS NULL OR "completedAt" >= "firstAccessedAt"));
ALTER TABLE "Lesson" ADD CONSTRAINT "lesson_content_size" CHECK ("structuredContent" IS NULL OR octet_length("structuredContent"::text) <= 100000);
