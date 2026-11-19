-- Optional public editorial pages only. Existing offerings and LMS records are unchanged.
CREATE TYPE "MarketplaceSectionType" AS ENUM ('OVERVIEW', 'OUTCOMES', 'CURRICULUM', 'ELIGIBILITY', 'WHO_IS_IT_FOR', 'HIGHLIGHTS', 'FAQ', 'TEXT');

CREATE TABLE "MarketplaceOfferingPage" (
  "offeringId" TEXT NOT NULL,
  "revision" UUID NOT NULL,
  "eyebrow" TEXT,
  "heroHeadline" TEXT,
  "heroSummary" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "MarketplaceOfferingPage_pkey" PRIMARY KEY ("offeringId"),
  CONSTRAINT "marketplace_page_metadata_bounds" CHECK (
    ("eyebrow" IS NULL OR length("eyebrow") <= 100) AND
    ("heroHeadline" IS NULL OR length("heroHeadline") <= 200) AND
    ("heroSummary" IS NULL OR length("heroSummary") <= 1200) AND
    ("seoTitle" IS NULL OR length("seoTitle") <= 160) AND
    ("seoDescription" IS NULL OR length("seoDescription") <= 320)
  )
);

CREATE TABLE "MarketplaceOfferingSection" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "type" "MarketplaceSectionType" NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "position" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "contentJson" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "MarketplaceOfferingSection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marketplace_section_position" CHECK ("position" BETWEEN 0 AND 100000),
  CONSTRAINT "marketplace_section_title" CHECK (length(btrim("title")) BETWEEN 1 AND 160),
  CONSTRAINT "marketplace_section_subtitle" CHECK ("subtitle" IS NULL OR length("subtitle") <= 300),
  CONSTRAINT "marketplace_section_content_object" CHECK (jsonb_typeof("contentJson") = 'object')
);

CREATE UNIQUE INDEX "MarketplaceOfferingSection_pageId_position_key" ON "MarketplaceOfferingSection"("pageId", "position");
CREATE INDEX "MarketplaceOfferingSection_pageId_enabled_position_idx" ON "MarketplaceOfferingSection"("pageId", "enabled", "position");
ALTER TABLE "MarketplaceOfferingPage" ADD CONSTRAINT "MarketplaceOfferingPage_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "MarketplaceOffering"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "MarketplaceOfferingSection" ADD CONSTRAINT "MarketplaceOfferingSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MarketplaceOfferingPage"("offeringId") ON DELETE RESTRICT ON UPDATE RESTRICT;
