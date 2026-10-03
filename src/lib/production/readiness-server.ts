import 'server-only';
import { getDatabase } from '../db/client';
import { readiness, migrationsReady, type MigrationRow } from './readiness';
import { platformEnvironment } from './config';
import { upstashReady } from './upstash';
import { logUnavailable } from './request-context';
let pending: Promise<boolean> | undefined,
  expires = 0,
  last = false;
export async function databaseReady() {
  const db = getDatabase();
  return db.$transaction(
    async (tx) => {
      const schema =
        new URL(process.env.DATABASE_URL!).searchParams.get('schema') ||
        'public';
      if (schema !== 'public' && !/^d4_[a-f0-9]{24}$/.test(schema))
        return false;
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '2000ms'");
      const identity = await tx.$queryRaw<
        { name: string; schema: string }[]
      >`SELECT current_database() AS name, current_schema() AS schema`;
      const mode = platformEnvironment(),
        expected =
          mode === 'production'
            ? process.env.PRODUCTION_DATABASE_NAME
            : new URL(process.env.DATABASE_URL!).pathname.slice(1);
      if (
        identity[0]?.name !== expected ||
        identity[0]?.schema !==
          (new URL(process.env.DATABASE_URL!).searchParams.get('schema') ||
            'public')
      )
        return false;
      const rows = await tx.$queryRaw<
        MigrationRow[]
      >`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`;
      if (!migrationsReady(rows)) return false;
      const guards = await tx.$queryRaw<
        { count: bigint }[]
      >`SELECT count(*) AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relname='AcademicAudit' AND t.tgenabled='O' AND t.tgname IN ('academic_audit_append_only','academic_audit_no_truncate')`;
      const tables = await tx.$queryRaw<
        { count: bigint }[]
      >`SELECT count(*) AS count FROM information_schema.tables WHERE table_schema=current_schema() AND table_name IN ('User','Enrollment','Batch','LearningItem','AcademicAudit','AdminAuthorization')`;
      return Number(guards[0]?.count) === 2 && Number(tables[0]?.count) === 6;
    },
    { maxWait: 1000, timeout: 3000 },
  );
}
export async function applicationReady() {
  if (Date.now() < expires) return last;
  if (!pending)
    pending = readiness(process.env, databaseReady, () => upstashReady())
      .then((result) => {
        last = result;
        expires = Date.now() + 5000;
        if (!result) logUnavailable('READINESS_UNAVAILABLE');
        return result;
      })
      .finally(() => {
        pending = undefined;
      });
  return pending;
}
