// Provider-free public-page test server. Never imported by production code.
import { readFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
const env = { ...process.env };
for (const file of [
  '.env',
  '.env.local',
  '.env.production',
  '.env.production.local',
]) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const line of text.split('\n')) {
    const key = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (key) env[key[1]] = '';
  }
}
for (const key of Object.keys(env))
  if (/RAZORPAY|CLERK|DATABASE_URL|UPSTASH|BETTER_STACK/.test(key))
    env[key] = '';
Object.assign(env, { MENTORALM_ENV: 'local', NEXT_TELEMETRY_DISABLED: '1' });
mkdirSync('docs/reviews/legal-v1', { recursive: true });
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3114',
  ],
  { env, stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code || 0));
