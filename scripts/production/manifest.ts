import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { migrationManifest } from '../../src/lib/production/migrations';
export function verifyReleaseManifest() {
  const names = readdirSync('prisma/migrations')
    .filter((n) => /^\d{14}_/.test(n))
    .sort();
  if (
    names.length !== 11 ||
    names.join() !== migrationManifest.map((m) => m.name).join()
  )
    throw Error('Release migration manifest mismatch.');
  for (const m of migrationManifest) {
    const sql = readFileSync(
      `prisma/migrations/${m.name}/migration.sql`,
      'utf8',
    );
    if (createHash('sha256').update(sql).digest('hex') !== m.checksum)
      throw Error('Migration checksum changed.');
  }
  return names.length;
}
