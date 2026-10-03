import {
  validateEnvironment,
  upstashConfiguration,
  type Environment,
} from './config';
import { migrationManifest } from './migrations';
export interface MigrationRow {
  migration_name: string;
  checksum: string;
  finished_at: unknown;
  rolled_back_at: unknown;
}
export function migrationsReady(rows: MigrationRow[], complete = true) {
  const applied = rows.filter((r) => !r.rolled_back_at);
  if (
    applied.some((r) => !r.finished_at) ||
    new Set(applied.map((r) => r.migration_name)).size !== applied.length
  )
    return false;
  if (
    applied.some(
      (r) =>
        !migrationManifest.some(
          (m) => m.name === r.migration_name && m.checksum === r.checksum,
        ),
    )
  )
    return false;
  const expected = complete
    ? migrationManifest
    : migrationManifest.slice(0, applied.length);
  return (
    expected.length === applied.length &&
    expected.every((m) => applied.some((r) => r.migration_name === m.name))
  );
}
export async function readiness(
  env: Environment,
  probe: () => Promise<boolean>,
  limiterProbe: () => Promise<boolean> = async () => false,
) {
  try {
    const config = validateEnvironment(env);
    if (
      !env.DATABASE_URL ||
      !env.CLERK_SECRET_KEY ||
      !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    )
      return false;
    if (!(await probe())) return false;
    if (config.mode !== 'production') return true;
    upstashConfiguration(env);
    return await limiterProbe();
  } catch {
    return false;
  }
}
export function providerReadiness(env: Environment = process.env) {
  let distributed = false;
  try {
    upstashConfiguration(env);
    distributed = true;
  } catch {
    /* Missing/invalid configuration. */
  }
  return {
    objectStorage: 'NOT CONFIGURED',
    localFilesystem: 'NOT PRODUCTION READY',
    video: 'NOT CONFIGURED',
    certificateRendering: 'NOT CONFIGURED',
    email: 'NOT CONFIGURED',
    whatsApp: 'NOT CONFIGURED',
    inAppDelivery: 'NOT CONFIGURED',
    distributedRateLimiting: distributed
      ? 'CONFIGURED — AVAILABILITY NOT PROBED'
      : 'NOT CONFIGURED',
  } as const;
}
