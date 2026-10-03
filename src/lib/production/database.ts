import type { PoolConfig } from 'pg';
import { validateEnvironment, type Environment } from './config';
export function databasePoolConfig(env: Environment = process.env): PoolConfig {
  const config = validateEnvironment(env);
  const u = new URL(env.DATABASE_URL || '');
  // Prisma CLI and pg do not interpret sslmode identically. Pass verified TLS explicitly to pg.
  if (config.mode === 'production') {
    u.searchParams.delete('sslmode');
    u.searchParams.delete('sslaccept');
  }
  u.searchParams.delete('schema');
  return {
    connectionString: u.toString(),
    max: config.poolMax,
    connectionTimeoutMillis: config.connectTimeout,
    idleTimeoutMillis: config.idleTimeout,
    query_timeout: 10000,
    statement_timeout: 10000,
    ...(config.mode === 'production'
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
  };
}
