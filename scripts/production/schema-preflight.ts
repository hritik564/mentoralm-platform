import type { Client } from 'pg';
/** Only the application namespace is inspected; system/other-provider schemas are not exempted inside it. */
export async function applicationSchemaEmpty(
  client: Client,
  schema = 'public',
) {
  const result = await client.query<{ present: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1 FROM pg_class WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname=$1)
      UNION ALL SELECT 1 FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname=$1)
      UNION ALL SELECT 1 FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname=$1)
      UNION ALL SELECT 1 FROM pg_extension WHERE extnamespace = (SELECT oid FROM pg_namespace WHERE nspname=$1)
      UNION ALL SELECT 1 FROM pg_collation WHERE collnamespace = (SELECT oid FROM pg_namespace WHERE nspname=$1)
      UNION ALL SELECT 1 FROM pg_operator WHERE oprnamespace = (SELECT oid FROM pg_namespace WHERE nspname=$1)
      UNION ALL SELECT 1 FROM pg_conversion WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname=$1)
    ) AS present`,
    [schema],
  );
  return result.rows[0]?.present === false;
}
