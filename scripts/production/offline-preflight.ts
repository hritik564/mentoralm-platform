import { validateEnvironment } from '../../src/lib/production/config';
import { providerReadiness } from '../../src/lib/production/readiness';
import { verifyReleaseManifest } from './manifest';
try {
  if (process.argv.slice(2).join(' ') !== '--confirm-production-configuration')
    throw Error();
  if (validateEnvironment().mode !== 'production') throw Error();
  console.info(
    JSON.stringify({
      phase: 'P1',
      configuration: 'VALID',
      migrations: verifyReleaseManifest(),
      networkConnections: 0,
      trafficReady: false,
      providers: providerReadiness(),
    }),
  );
} catch {
  console.error(
    'Production configuration preflight refused or invalid. No database/provider was contacted. Consult the runbook; values withheld.',
  );
  process.exitCode = 1;
}
