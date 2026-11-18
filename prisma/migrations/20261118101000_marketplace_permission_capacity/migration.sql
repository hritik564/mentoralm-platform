-- Keep the existing permission-set invariants with the thirteenth capability.
-- No grants, backfill or business-data writes.
CREATE OR REPLACE FUNCTION valid_admin_permissions(p "AdminPermission"[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NOT NULL AND cardinality(p) <= 13 AND (cardinality(p)=0 OR array_ndims(p)=1)
    AND NOT EXISTS(SELECT 1 FROM unnest(p) v WHERE v IS NULL)
    AND cardinality(p)=(SELECT count(DISTINCT v) FROM unnest(p) v);
$$;
