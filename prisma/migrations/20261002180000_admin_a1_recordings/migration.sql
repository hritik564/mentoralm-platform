-- CreateEnum
CREATE TYPE "BatchSessionRecordingStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'PUBLISHED', 'FAILED');

-- AlterTable
ALTER TABLE "BatchSession" ADD COLUMN     "instructorId" TEXT;

-- CreateTable
CREATE TABLE "BatchSessionRecording" (
    "sessionId" TEXT NOT NULL,
    "revision" UUID NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "assetRef" TEXT,
    "title" TEXT,
    "description" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "bytes" BIGINT,
    "durationSeconds" INTEGER,
    "status" "BatchSessionRecordingStatus" NOT NULL DEFAULT 'UPLOADING',
    "readyAt" TIMESTAMPTZ(6),
    "publishedAt" TIMESTAMPTZ(6),
    "cleanupRequestedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BatchSessionRecording_pkey" PRIMARY KEY ("sessionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatchSessionRecording_revision_key" ON "BatchSessionRecording"("revision");

-- CreateIndex
CREATE INDEX "BatchSessionRecording_status_updatedAt_idx" ON "BatchSessionRecording"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "BatchSessionRecording_cleanupRequestedAt_idx" ON "BatchSessionRecording"("cleanupRequestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BatchSessionRecording_storageProvider_assetRef_key" ON "BatchSessionRecording"("storageProvider", "assetRef");

-- CreateIndex
CREATE INDEX "BatchSession_instructorId_idx" ON "BatchSession"("instructorId");

-- AddForeignKey
ALTER TABLE "BatchSession" ADD CONSTRAINT "BatchSession_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "BatchSessionRecording" ADD CONSTRAINT "BatchSessionRecording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BatchSession"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Readiness is externally attested by the trusted storage adapter; these checks enforce stored invariants.
ALTER TABLE "BatchSessionRecording" ADD CONSTRAINT "recording_reference" CHECK (length(trim("storageProvider")) > 0 AND ("assetRef" IS NULL OR (length(trim("assetRef")) > 0 AND "assetRef" !~* '^[a-z][a-z0-9+.-]*://')));
ALTER TABLE "BatchSessionRecording" ADD CONSTRAINT "recording_bytes" CHECK ("bytes" IS NULL OR "bytes" > 0);
ALTER TABLE "BatchSessionRecording" ADD CONSTRAINT "recording_duration" CHECK ("durationSeconds" IS NULL OR "durationSeconds" >= 0);
ALTER TABLE "BatchSessionRecording" ADD CONSTRAINT "recording_ready" CHECK ("status" NOT IN ('READY','PUBLISHED') OR ("assetRef" IS NOT NULL AND "readyAt" IS NOT NULL));
ALTER TABLE "BatchSessionRecording" ADD CONSTRAINT "recording_publication" CHECK (("status" = 'PUBLISHED') = ("publishedAt" IS NOT NULL) AND ("status" <> 'PUBLISHED' OR "cleanupRequestedAt" IS NULL));
