import {
  neonDirectUrl,
  validateEnvironment,
  type Environment,
} from '../../src/lib/production/config';
export function operatorIntent(
  env: Environment,
  command: string,
  args: string[],
) {
  if (
    validateEnvironment(env).mode !== 'production' ||
    !['preflight', 'deploy', 'status'].includes(command)
  )
    throw Error('Production intent required.');
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
  const u = neonDirectUrl(
    env.MIGRATION_DATABASE_URL,
    env.PRODUCTION_DATABASE_NAME,
  );
  if (
    input.get('confirm-production') !== env.PRODUCTION_DATABASE_NAME ||
    input.get('expected-host') !== u.hostname ||
    !/^[a-zA-Z0-9_.:-]{1,120}$/.test(input.get('change-ticket') || '')
  )
    throw Error('Target confirmation required.');
  if (command === 'deploy') {
    const timestamp = Date.parse(input.get('backup-timestamp') || ''),
      age = Date.now() - timestamp;
    if (
      !/^[a-zA-Z0-9_.:-]{1,120}$/.test(input.get('backup-reference') || '') ||
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
