import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { runtimeArguments } from '../../src/lib/production/runtime.mjs';
import nextEnv from '@next/env';
import { validateEnvironment } from '../../src/lib/production/config-runtime.mjs';
import { publicConfigurationHash } from '../../src/lib/production/public-config.mjs';
try {
  // Production must not import local secrets/fixtures into its startup environment.
  if (process.env.MENTORALM_ENV === 'production') {
    if (
      [
        '.env.local',
        '.env.production.local',
        '.env.development.local',
        '.env.test.local',
      ].some(existsSync)
    )
      throw Error('Local environment files forbidden in Production artifact.');
  } else nextEnv.loadEnvConfig(process.cwd(), false);
  process.env.NODE_ENV = 'production';
  validateEnvironment();
  const artifact = JSON.parse(
    readFileSync('.next/required-server-files.json', 'utf8'),
  );
  if (
    artifact.config?.env?.MENTORALM_BUILD_PUBLIC_CONFIG_HASH !==
    publicConfigurationHash()
  )
    throw Error('Build public configuration mismatch.');
  const args = runtimeArguments(process.env, process.argv.slice(2));
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', ...args],
    { stdio: 'inherit', env: process.env },
  );
  let shutdownTimer;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => {
      child.kill(signal);
      shutdownTimer ??= setTimeout(() => child.kill('SIGKILL'), 10000);
      shutdownTimer.unref();
    });
  child.on('error', () => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'startup',
        code: 'START_FAILED',
      }),
    );
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    clearTimeout(shutdownTimer);
    process.exitCode = code ?? 1;
  });
} catch {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'configuration_invalid',
      code: 'START_REFUSED',
    }),
  );
  process.exitCode = 1;
}
