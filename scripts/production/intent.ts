import {
  neonDirectUrl,
  type Environment,
} from '../../src/lib/production/config';

const PG_OVERRIDE_KEYS = [
  'PGHOST',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
  'PGOPTIONS',
] as const;

function databaseOperatorEnvironment(env: Environment) {
  if (
    env.MENTORALM_ENV !== 'production' ||
    env.NODE_ENV !== 'production' ||
    env.PRODUCTION_DATABASE_NAME !== 'mentoralm'
  ) {
    throw Error('Production database environment required.');
  }

  const raw = env as unknown as Record<string, string | undefined>;

  if (PG_OVERRIDE_KEYS.some((key) => raw[key])) {
    throw Error('PostgreSQL environment overrides are forbidden.');
  }

  const runtime = neonDirectUrl(
    env.DATABASE_URL,
    env.PRODUCTION_DATABASE_NAME,
  );

  const migration = neonDirectUrl(
    env.MIGRATION_DATABASE_URL,
    env.PRODUCTION_DATABASE_NAME,
  );

  if (
    runtime.username !== 'mentoralm_runtime' ||
    migration.username !== 'mentoralm_migrator' ||
    runtime.hostname !== migration.hostname
  ) {
    throw Error('Production database role or branch mismatch.');
  }

  return migration;
}

export function operatorIntent(
  env: Environment,
  command: string,
  args: string[],
) {
  if (!['preflight', 'deploy', 'status'].includes(command))
    throw Error('Production intent required.');

  const u = databaseOperatorEnvironment(env);

  const input = new Map<string, string>();

  for (const arg of args) {
    const m = /^--([a-z-]+)=(.+)$/.exec(arg);

    if (
      !m ||
      input.has(m[1]) ||
      ![
        'confirm-production',
        'expected-host',
        'change-ticket',
        'backup-reference',
        'backup-timestamp',
      ].includes(m[1])
    )
      throw Error('Invalid operator input.');

    input.set(m[1], m[2]);
  }

  if (
    input.get('confirm-production') !== env.PRODUCTION_DATABASE_NAME ||
    input.get('expected-host') !== u.hostname ||
    !/^[a-zA-Z0-9_.:-]{1,120}$/.test(input.get('change-ticket') || '')
  )
    throw Error('Target confirmation required.');

  if (command === 'deploy') {
    const timestamp = Date.parse(input.get('backup-timestamp') || '');
    const age = Date.now() - timestamp;

    if (
      !/^[a-zA-Z0-9_.:-]{1,120}$/.test(
        input.get('backup-reference') || '',
      ) ||
      !Number.isFinite(timestamp) ||
      age < 0 ||
      age > 86400000
    )
      throw Error('Recent verified backup evidence required.');
  }

  return {
    url: u,
    database: env.PRODUCTION_DATABASE_NAME!,
    schema: 'public',
    ticket: input.get('change-ticket')!,
  };
}
