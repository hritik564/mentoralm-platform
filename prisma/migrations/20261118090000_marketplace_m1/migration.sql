-- Marketplace catalogue metadata only. No LMS enrollment or entitlement change.
CREATE TYPE "MarketplaceDeliveryMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');
CREATE TYPE "MarketplacePublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');
CREATE TYPE "MarketplaceAvailabilityStatus" AS ENUM ('OPEN', 'COMING_SOON', 'WAITLIST', 'CLOSED');

CREATE TABLE "MarketplaceOffering" (
  "id" TEXT NOT NULL,
  "revision" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "shortDescription" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "cardImage" TEXT,
  "heroImage" TEXT,
  "deliveryMode" "MarketplaceDeliveryMode" NOT NULL DEFAULT 'ONLINE',
  "durationLabel" TEXT NOT NULL,
  "priceMinor" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "availabilityStatus" "MarketplaceAvailabilityStatus" NOT NULL DEFAULT 'COMING_SOON',
  "publicationStatus" "MarketplacePublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "lmsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "courseId" TEXT,
  "cohortStartsAt" TIMESTAMPTZ(6),
  "publishedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "MarketplaceOffering_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marketplace_slug" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("slug") <= 100),
  CONSTRAINT "marketplace_price" CHECK ("priceMinor" IS NULL OR "priceMinor" >= 0),
  CONSTRAINT "marketplace_currency" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "marketplace_sort" CHECK ("sortOrder" BETWEEN 0 AND 100000),
  CONSTRAINT "marketplace_lms_disabled" CHECK ("lmsEnabled" OR "courseId" IS NULL),
  CONSTRAINT "marketplace_published" CHECK ("publicationStatus" <> 'PUBLISHED' OR ("publishedAt" IS NOT NULL AND (NOT "lmsEnabled" OR "courseId" IS NOT NULL)))
);

CREATE UNIQUE INDEX "MarketplaceOffering_slug_key" ON "MarketplaceOffering"("slug");
CREATE INDEX "MarketplaceOffering_publicationStatus_featured_sortOrder_idx" ON "MarketplaceOffering"("publicationStatus", "featured", "sortOrder");
CREATE INDEX "MarketplaceOffering_courseId_idx" ON "MarketplaceOffering"("courseId");
ALTER TABLE "MarketplaceOffering" ADD CONSTRAINT "MarketplaceOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
