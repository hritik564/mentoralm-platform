CREATE TYPE "AdminAuthority" AS ENUM ('SCOPED', 'GOVERNANCE');
CREATE TYPE "AdminPermission" AS ENUM ('STUDENTS_MANAGE','BATCHES_MANAGE','ACADEMICS_MANAGE','ATTENDANCE_MANAGE','CERTIFICATES_MANAGE','DISCUSSIONS_MANAGE','SUPPORT_MANAGE','COMMUNICATIONS_MANAGE','REFERRALS_VIEW','USERS_VIEW','AUDIT_VIEW','SETTINGS_VIEW');
CREATE FUNCTION valid_admin_permissions(p "AdminPermission"[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NOT NULL AND cardinality(p) <= 12 AND (cardinality(p)=0 OR array_ndims(p)=1)
    AND NOT EXISTS(SELECT 1 FROM unnest(p) v WHERE v IS NULL)
    AND cardinality(p)=(SELECT count(DISTINCT v) FROM unnest(p) v);
$$;
CREATE TABLE "AdminAuthorization" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "authority" "AdminAuthority" NOT NULL DEFAULT 'SCOPED',
  "permissions" "AdminPermission"[] NOT NULL DEFAULT ARRAY[]::"AdminPermission"[],
  "revision" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "AdminAuthorization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "admin_permission_set" CHECK(valid_admin_permissions("permissions")),
  CONSTRAINT "admin_governance_permission_set" CHECK("authority" <> 'GOVERNANCE' OR cardinality("permissions")=0)
);
CREATE INDEX "AdminAuthorization_authority_userId_idx" ON "AdminAuthorization"("authority","userId");
-- Preserve precisely the pre-A4 operational ability of existing effective Admins. No governance backfill.
INSERT INTO "AdminAuthorization" ("userId","authority","permissions","revision","updatedAt")
SELECT u.id,'SCOPED',ARRAY['STUDENTS_MANAGE','BATCHES_MANAGE','ACADEMICS_MANAGE','ATTENDANCE_MANAGE','CERTIFICATES_MANAGE','DISCUSSIONS_MANAGE','SUPPORT_MANAGE','COMMUNICATIONS_MANAGE','REFERRALS_VIEW']::"AdminPermission"[],gen_random_uuid(),CURRENT_TIMESTAMP
FROM "User" u WHERE u.role='ADMIN' OR EXISTS(SELECT 1 FROM "UserRoleAssignment" a WHERE a."userId"=u.id AND a.role='ADMIN');
CREATE INDEX "AcademicAudit_createdAt_id_idx" ON "AcademicAudit"("createdAt" DESC,"id" DESC);
CREATE INDEX "AcademicAudit_actorId_createdAt_id_idx" ON "AcademicAudit"("actorId","createdAt" DESC,"id" DESC);
CREATE INDEX "AcademicAudit_action_createdAt_id_idx" ON "AcademicAudit"("action","createdAt" DESC,"id" DESC);
CREATE FUNCTION reject_academic_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Academic audit is append-only';
END $$;
CREATE TRIGGER academic_audit_append_only BEFORE UPDATE OR DELETE ON "AcademicAudit" FOR EACH ROW EXECUTE FUNCTION reject_academic_audit_mutation();
CREATE TRIGGER academic_audit_no_truncate BEFORE TRUNCATE ON "AcademicAudit" FOR EACH STATEMENT EXECUTE FUNCTION reject_academic_audit_mutation();
