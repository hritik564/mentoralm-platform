-- Preserve all existing page content as draft. Publication requires an explicit action.
CREATE TABLE "MarketplaceOfferingPageVersion" (
  "pageId" TEXT NOT NULL,
  "revision" UUID NOT NULL,
  "snapshotJson" JSONB NOT NULL,
  "publishedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceOfferingPageVersion_pkey" PRIMARY KEY ("pageId", "revision"),
  CONSTRAINT "marketplace_page_version_snapshot" CHECK (
    jsonb_typeof("snapshotJson") = 'object' AND
    "snapshotJson" ?& ARRAY['schemaVersion', 'settings', 'sections'] AND
    ("snapshotJson" - ARRAY['schemaVersion', 'settings', 'sections']) = '{}'::jsonb AND
    "snapshotJson" -> 'schemaVersion' = '1'::jsonb AND
    jsonb_typeof("snapshotJson" -> 'settings') = 'object' AND
    jsonb_typeof("snapshotJson" -> 'sections') = 'array' AND
    jsonb_array_length("snapshotJson" -> 'sections') <= 20
  )
);

ALTER TABLE "MarketplaceOfferingPage" ADD COLUMN "publishedRevision" UUID;
ALTER TABLE "MarketplaceOfferingPageVersion" ADD CONSTRAINT "MarketplaceOfferingPageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "MarketplaceOfferingPage"("offeringId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "MarketplaceOfferingPage" ADD CONSTRAINT "MarketplaceOfferingPage_published_version_fkey" FOREIGN KEY ("offeringId", "publishedRevision") REFERENCES "MarketplaceOfferingPageVersion"("pageId", "revision") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION reject_marketplace_page_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Marketplace page versions are immutable';
END;
$$;
CREATE TRIGGER marketplace_page_version_append_only BEFORE UPDATE OR DELETE ON "MarketplaceOfferingPageVersion" FOR EACH ROW EXECUTE FUNCTION reject_marketplace_page_version_mutation();
CREATE TRIGGER marketplace_page_version_no_truncate BEFORE TRUNCATE ON "MarketplaceOfferingPageVersion" FOR EACH STATEMENT EXECUTE FUNCTION reject_marketplace_page_version_mutation();
