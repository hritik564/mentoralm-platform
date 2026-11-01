BEGIN;

-- Prevent concurrent student creation while the identifier trigger is replaced.
LOCK TABLE "User" IN ACCESS EXCLUSIVE MODE;

-- The existing constraint only accepts MLM-STU-*.
ALTER TABLE "User"
  DROP CONSTRAINT "student_id_format";

-- Temporarily remove the immutability trigger so existing identifiers
-- can be migrated in-place without changing their year/serial number.
DROP TRIGGER "user_student_id" ON "User";

-- Preserve the existing year and serial; change only the prefix.
UPDATE "User"
SET "studentId" = regexp_replace(
  "studentId",
  '^MLM-STU-([0-9]{4}-[0-9]{6,})$',
  'ST-\1'
)
WHERE "studentId" ~ '^MLM-STU-[0-9]{4}-[0-9]{6,}$';

-- Refuse the migration if any unexpected legacy identifier remains.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    WHERE "studentId" IS NOT NULL
      AND "studentId" !~ '^ST-[0-9]{4}-[0-9]{6,}$'
  ) THEN
    RAISE EXCEPTION 'Unexpected Student identifier format detected';
  END IF;
END;
$$;

-- Future Student IDs use ST-YYYY-NNNNNN.
CREATE OR REPLACE FUNCTION issue_student_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  serial_value text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."studentId" IS NOT NULL
     AND NEW."studentId" IS DISTINCT FROM OLD."studentId"
  THEN
    RAISE EXCEPTION 'Student identifier is immutable';
  END IF;

  IF TG_OP = 'INSERT' AND NEW."studentId" IS NOT NULL THEN
    RAISE EXCEPTION 'Student identifier must be generated';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD."studentId" IS NULL
     AND NEW."studentId" IS NOT NULL
  THEN
    RAISE EXCEPTION 'Student identifier must be generated';
  END IF;

  IF NEW."role" = 'STUDENT' AND NEW."studentId" IS NULL THEN
    serial_value :=
      nextval(
        format('%I.%I', TG_TABLE_SCHEMA, 'student_id_seq')::regclass
      )::text;

    NEW."studentId" :=
      'ST-' ||
      to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY') ||
      '-' ||
      CASE
        WHEN length(serial_value) < 6
          THEN lpad(serial_value, 6, '0')
        ELSE serial_value
      END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "user_student_id"
BEFORE INSERT OR UPDATE ON "User"
FOR EACH ROW
EXECUTE FUNCTION issue_student_id();

ALTER TABLE "User"
  ADD CONSTRAINT "student_id_format"
  CHECK (
    "studentId" IS NULL
    OR "studentId" ~ '^ST-[0-9]{4}-[0-9]{6,}$'
  );

COMMIT;
