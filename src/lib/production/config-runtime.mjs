// Canonical runtime validator: plain ESM so the startup guard needs no TypeScript loader.
export class ConfigurationError extends Error {
  fields;
  constructor(fields) {
    super(`Invalid platform configuration: ${fields.join(', ')}.`);
    this.fields = fields;
    this.name = 'ConfigurationError';
  }
}
export const approvedOrigins = {
  NEXT_PUBLIC_SITE_URL: 'https://mentoralm.com',
  NEXT_PUBLIC_LMS_ORIGIN: 'https://students.mentoralm.com',
  NEXT_PUBLIC_ADMIN_ORIGIN: 'https://admin.mentoralm.com',
};
export function platformEnvironment(env = process.env) {
  if (['local', 'test', 'production'].includes(env.MENTORALM_ENV || ''))
    return env.MENTORALM_ENV;
  if (!env.MENTORALM_ENV && env.NODE_ENV !== 'production') return 'local';
  throw new ConfigurationError(['MENTORALM_ENV']);
}
const loopback = (host) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
export function productionDatabaseUrl(value, expected) {
  try {
    const u = new URL(value || '');
    if (
      !expected ||
      !/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(expected) ||
      /(?:_dev$|_test$)/i.test(expected) ||
      !['postgres:', 'postgresql:'].includes(u.protocol) ||
      !u.hostname ||
      loopback(u.hostname) ||
      /^127\./.test(u.hostname) ||
      ['0.0.0.0', '[::]'].includes(u.hostname) ||
      /^\[::ffff:7f[0-9a-f]{2}:/i.test(u.hostname) ||
      u.hostname.endsWith('.localhost') ||
      !u.username ||
      !u.password ||
      u.hash ||
      decodeURIComponent(u.pathname.slice(1)) !== expected ||
      u.searchParams.get('sslmode') !== 'require' ||
      u.searchParams.get('sslaccept') !== 'strict' ||
      (u.searchParams.has('schema') &&
        u.searchParams.get('schema') !== 'public')
    )
      throw Error();
    const seen = new Set();
    for (const [k] of u.searchParams) {
      if (!['schema', 'sslmode', 'sslaccept'].includes(k) || seen.has(k))
        throw Error();
      seen.add(k);
    }
    return u;
  } catch {
    throw new ConfigurationError(['production database']);
  }
}
export function validateEnvironment(env = process.env) {
  const mode = platformEnvironment(env),
    failures = [];
  if (mode === 'production') {
    for (const [key, value] of Object.entries(approvedOrigins))
      if (env[key] !== value) failures.push(key);
    if (
      !/^pk_live_[a-zA-Z0-9_=+-]+$/.test(
        env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
      )
    )
      failures.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    try {
      const encoded = (env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '').slice(
        'pk_live_'.length,
      );
      if (atob(encoded) !== 'clerk.mentoralm.com$')
        failures.push('Clerk Production primary domain');
    } catch {
      failures.push('Clerk Production primary domain');
    }
    if (env.NODE_ENV && env.NODE_ENV !== 'production')
      failures.push('production NODE_ENV');
    for (const key of [
      'PGHOST',
      'PGPORT',
      'PGDATABASE',
      'PGUSER',
      'PGPASSWORD',
      'PGOPTIONS',
    ])
      if (env[key]) failures.push('unexpected PG override');
    if (!/^sk_live_[a-zA-Z0-9]+$/.test(env.CLERK_SECRET_KEY || ''))
      failures.push('CLERK_SECRET_KEY');
    try {
      productionDatabaseUrl(env.DATABASE_URL, env.PRODUCTION_DATABASE_NAME);
    } catch {
      failures.push('DATABASE_URL / PRODUCTION_DATABASE_NAME');
    }
    if (env.TEST_DATABASE_URL || env.ALLOW_DATABASE_TESTS === '1')
      failures.push('test configuration forbidden');
    for (const key of [
      'LMS_FILES_ROOT',
      'LMS_SUBMISSIONS_ROOT',
      'RESOURCE_FILES_ROOT',
    ])
      if (env[key]) failures.push(`${key}: local filesystem forbidden`);
    if (
      (env.CLERK_DEBUG && !['0', 'false'].includes(env.CLERK_DEBUG)) ||
      (env.NEXT_PUBLIC_CLERK_DEBUG &&
        !['0', 'false'].includes(env.NEXT_PUBLIC_CLERK_DEBUG)) ||
      env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ||
      env.PGSSLMODE === 'disable'
    )
      failures.push('unsafe debug/TLS override');
    if (
      env.REFERRAL_APP_ORIGIN &&
      env.REFERRAL_APP_ORIGIN !== approvedOrigins.NEXT_PUBLIC_SITE_URL
    )
      failures.push('REFERRAL_APP_ORIGIN');
  } else {
    if (
      env.CLERK_SECRET_KEY?.startsWith('sk_live_') ||
      env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_')
    )
      failures.push('live Clerk forbidden');
    if (env.DATABASE_URL) {
      try {
        const u = new URL(env.DATABASE_URL);
        const schema = u.searchParams.get('schema');
        if (
          u.hash ||
          [...u.searchParams.keys()].some((k) => k !== 'schema') ||
          (schema &&
            (mode === 'local'
              ? schema !== 'public'
              : !/^d4_[a-f0-9]{24}$/.test(schema)))
        )
          failures.push('local/test connection overrides');
        if (
          !['postgres:', 'postgresql:'].includes(u.protocol) ||
          !(
            loopback(u.hostname) ||
            /^127\./.test(u.hostname) ||
            ['0.0.0.0', '[::]'].includes(u.hostname) ||
            /^\[::ffff:7f[0-9a-f]{2}:/i.test(u.hostname)
          ) ||
          (mode === 'local'
            ? u.pathname !== '/mentoralm_dev'
            : !/^\/[a-zA-Z0-9_-]+_test$/.test(u.pathname))
        )
          failures.push('local/test DATABASE_URL boundary');
      } catch {
        failures.push('DATABASE_URL');
      }
    }
  }
  const integer = (name, fallback, min, max) => {
    const raw = env[name];
    if (
      raw !== undefined &&
      (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max)
    )
      failures.push(name);
    return raw === undefined ? fallback : Number(raw);
  };
  const poolMax = integer('DATABASE_POOL_MAX', 8, 1, 30);
  const connectTimeout = integer(
    'DATABASE_CONNECT_TIMEOUT_MS',
    5000,
    1000,
    10000,
  );
  const idleTimeout = integer('DATABASE_IDLE_TIMEOUT_MS', 10000, 1000, 60000);
  if (mode === 'production') {
    if (env.RATE_LIMIT_BACKEND && env.RATE_LIMIT_BACKEND !== 'upstash')
      failures.push('RATE_LIMIT_BACKEND');
    try {
      neonDirectUrl(env.DATABASE_URL, env.PRODUCTION_DATABASE_NAME);
      if (env.MIGRATION_DATABASE_URL) {
        const app = neonDirectUrl(
          env.DATABASE_URL,
          env.PRODUCTION_DATABASE_NAME,
        );
        const migration = neonDirectUrl(
          env.MIGRATION_DATABASE_URL,
          env.PRODUCTION_DATABASE_NAME,
        );
        if (
          app.hostname !== migration.hostname ||
          (app.port || '5432') !== (migration.port || '5432')
        )
          failures.push('migration/runtime endpoint mismatch');
      }
    } catch {
      failures.push('Neon direct Singapore endpoint');
    }
    if (
      env.REPLIT_BOOTSTRAP_HOST &&
      !/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\.replit\.app$/.test(
        env.REPLIT_BOOTSTRAP_HOST,
      )
    )
      failures.push('REPLIT_BOOTSTRAP_HOST');
    if (env.UPSTASH_REDIS_REST_URL || env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        upstashConfiguration(env);
      } catch {
        failures.push('Upstash configuration');
      }
    }
  } else {
    if (env.RATE_LIMIT_BACKEND && env.RATE_LIMIT_BACKEND !== 'process-local')
      failures.push('RATE_LIMIT_BACKEND');
    if (
      env.UPSTASH_REDIS_REST_URL ||
      env.UPSTASH_REDIS_REST_TOKEN ||
      env.BETTER_STACK_INGEST_URL ||
      env.BETTER_STACK_SOURCE_TOKEN ||
      env.REPLIT_BOOTSTRAP_HOST
    )
      failures.push(
        'Production provider configuration forbidden in local/test',
      );
  }
  if (
    env.PRODUCTION_HTTPS_CONFIRMED &&
    !['0', '1'].includes(env.PRODUCTION_HTTPS_CONFIRMED)
  )
    failures.push('PRODUCTION_HTTPS_CONFIRMED');
  if (failures.length) throw new ConfigurationError(failures);
  return { mode, poolMax, connectTimeout, idleTimeout };
}

/** Direct Neon endpoint only: no transaction pooler and no endpoint/region inference. */
export function neonDirectUrl(value, expected) {
  const u = productionDatabaseUrl(value, expected);
  if (
    !/^ep-[a-z0-9-]+\.(?:c-[0-9]+\.)?ap-southeast-1\.aws\.neon\.tech$/.test(
      u.hostname,
    ) ||
    u.hostname.split('.')[0].endsWith('-pooler') ||
    (u.port && u.port !== '5432') ||
    expected === 'postgres'
  )
    throw new ConfigurationError(['Neon direct Singapore endpoint']);
  return u;
}
export function upstashConfiguration(env = process.env) {
  const u = new URL(env.UPSTASH_REDIS_REST_URL || '');
  const token = env.UPSTASH_REDIS_REST_TOKEN || '';
  if (
    env.MENTORALM_ENV !== 'production' ||
    (env.RATE_LIMIT_BACKEND && env.RATE_LIMIT_BACKEND !== 'upstash') ||
    u.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.upstash\.io$/.test(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== '/' ||
    !token ||
    token.length > 4096 ||
    /\s/.test(token)
  )
    throw new ConfigurationError(['Upstash configuration']);
  return { url: u.origin, token };
}
