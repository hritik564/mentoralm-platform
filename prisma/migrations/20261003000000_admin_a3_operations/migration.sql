-- Additive A3 review outcome; submitted answers/options remain immutable.
CREATE TABLE "AcademicResponseReview" (
  "responseId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "awardedPoints" INTEGER NOT NULL,
  "feedback" VARCHAR(2000),
  "reviewedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicResponseReview_pkey" PRIMARY KEY ("responseId"),
  CONSTRAINT "response_review_points" CHECK ("awardedPoints" >= 0),
  CONSTRAINT "response_review_feedback" CHECK ("feedback" IS NULL OR length(trim("feedback")) BETWEEN 1 AND 2000),
  CONSTRAINT "AcademicResponseReview_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AcademicResponse"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "AcademicResponseReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "AcademicResponseReview_reviewerId_reviewedAt_idx" ON "AcademicResponseReview"("reviewerId", "reviewedAt" DESC);
CREATE FUNCTION academic_review_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE valid boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."responseId" IS DISTINCT FROM OLD."responseId" THEN
    RAISE EXCEPTION 'Review response context is immutable';
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I."AcademicResponse" r JOIN %I."AcademicAttempt" a ON a.id=r."attemptId" WHERE r.id=$1 AND a.status=''SUBMITTED'' AND r.type IN (''SHORT_TEXT'',''LONG_TEXT'') AND r."requiresReview"=true AND $2 BETWEEN 0 AND r.points)',TG_TABLE_SCHEMA,TG_TABLE_SCHEMA)
    INTO valid USING NEW."responseId",NEW."awardedPoints";
  IF NOT valid THEN RAISE EXCEPTION 'Review requires a submitted text response and bounded snapshot points'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER academic_review_scope BEFORE INSERT OR UPDATE ON "AcademicResponseReview" FOR EACH ROW EXECUTE FUNCTION academic_review_scope();
CREATE FUNCTION academic_review_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Review history cannot be deleted';
END $$;
CREATE TRIGGER academic_review_no_delete BEFORE DELETE ON "AcademicResponseReview" FOR EACH ROW EXECUTE FUNCTION academic_review_no_delete();
ALTER TABLE "Certificate" ADD COLUMN "adminSuspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Certificate" ADD CONSTRAINT "certificate_admin_hold_status" CHECK (NOT "adminSuspended" OR "status"='SUSPENDED');
