import {
  requireMarketplaceBaseline,
  requireMarketplacePermissionBaseline,
} from '../scripts/marketplace/safety';
import { migrationManifest } from '../src/lib/production/migrations';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  adminHref,
  adminDestination,
  domainRoute,
} from '../src/lib/platform/domains';
import { adminPathPermission } from '../src/lib/admin/permissions';
import {
  workspaceDestinations,
  visibleAdminNavigation,
} from '../src/lib/admin/navigation';

const approvedHero = {
  'public/images/homepage/careerignite.webp':
    '8cc0992385e7b62fdc66718c83b1da3729130c934c5f9097a0fd2a6f31cb1f6d',
  'public/images/homepage/youngminds-ai-lab.webp':
    'd616175d4f208cde1fd87251d0f28fa298cf839419c9685cc2f27ec05db88657',
  'src/components/home/homepage/HeroCTA.tsx':
    'df1f1c83a4d7f6294788edeaf4a4f6c96aae79980a36554bac7fea2d33e375fe',
  'src/components/home/homepage/HomepageAtmosphere.tsx':
    'a473ea872c52c5bedc3ef25c908e99ff71a5fb57dfc848a8ceabd06d5acfdfaf',
  'src/components/home/homepage/HomepageHero.tsx':
    '846db6c4fa5c1defa9ce0e77ba554641877f36fff55e9a3dfd1f06932a3fb4e2',
  'src/components/home/homepage/ProgramCarousel.tsx':
    '34c7266457325c874773c41aff890b2f258e44ca088203e526438f12863c6792',
  'src/components/home/homepage/ProgramSlide.tsx':
    '396f858d2f4094088a35d09e89770de938a162c470041e391a31db5ce412cd6e',
  'src/components/home/homepage/programs.ts':
    'b4f0861c06a328fef08c9ce2fecc82be74b9c06c6d8a128c01b5a38a6ba62955',
  'src/styles/homepage-hero.css':
    'e08c0b326f40ff41a64895e7f35e73083b3e1e9bfd8a4f6cb7f1fbce44807016',
} as const;
test('M1 preserves every approved hero/carousel source, data, style and artwork byte', () => {
  for (const [path, hash] of Object.entries(approvedHero)) {
    assert.equal(
      createHash('sha256').update(readFileSync(path)).digest('hex'),
      hash,
      path,
    );
  }
});
test('M1 Marketplace has a dedicated permitted route as its own first-class Admin workspace', () => {
  assert.equal(
    adminPathPermission('/admin/marketplace/new'),
    'MARKETPLACE_MANAGE',
  );
  assert.ok(
    workspaceDestinations('marketplace', ['MARKETPLACE_MANAGE']).some(
      (destination) => destination.href === '/admin/marketplace',
    ),
  );
  assert.ok(
    !workspaceDestinations('learning', ['BATCHES_MANAGE']).some(
      (destination) => destination.href === '/admin/marketplace',
    ),
  );
  assert.equal(visibleAdminNavigation(['ACADEMICS_MANAGE']).length, 2);
  assert.ok(
    !visibleAdminNavigation(['ACADEMICS_MANAGE']).some(
      (group) => group.id === 'marketplace',
    ),
  );
  assert.ok(
    visibleAdminNavigation(['MARKETPLACE_MANAGE']).some(
      (group) => group.id === 'marketplace',
    ),
  );
  assert.ok(
    !workspaceDestinations('learning', [
      'ACADEMICS_MANAGE',
      'MARKETPLACE_MANAGE',
    ]).some((destination) => destination.href === '/admin/marketplace'),
  );
  for (const path of [
    '/admin/marketplace',
    '/admin/marketplace/new',
    '/admin/marketplace/opaque_ref',
  ]) {
    assert.equal(adminDestination(path), path);
    assert.ok(adminHref(path).endsWith(path));
    assert.deepEqual(domainRoute('admin.mentoralm.com', path.slice(6)), {
      kind: 'rewrite',
      path,
    });
  }
  for (const path of [
    '/admin/marketplace/a/../../users',
    '/admin/marketplace/a/private',
    '//evil.test',
    '/admin/marketplace?redirect_url=https://evil.test',
  ]) {
    assert.equal(adminDestination(path), '/admin');
    assert.throws(() => adminHref(path));
  }
});

test('M1 local deployment permits only its own pending migration and refuses unrelated baseline work', () => {
  const applied = migrationManifest
    .filter(
      (migration) =>
        migration.name !== '20261118110000_marketplace_page_content',
    )
    .map((migration) => ({
      migration_name: migration.name,
      checksum: migration.checksum,
      finished_at: new Date(),
      rolled_back_at: null,
    }));
  // Historical task-specific commands must refuse new M2 pending work.
  assert.throws(() => requireMarketplaceBaseline(applied));
  const complete = migrationManifest.map((migration) => ({
    migration_name: migration.name,
    checksum: migration.checksum,
    finished_at: new Date(),
    rolled_back_at: null,
  }));
  assert.deepEqual(requireMarketplaceBaseline(complete), []);
  assert.throws(() => requireMarketplaceBaseline(applied.slice(0, -1)));
  assert.throws(() => requireMarketplacePermissionBaseline(applied));
  assert.deepEqual(requireMarketplacePermissionBaseline(complete), []);
  assert.throws(() =>
    requireMarketplacePermissionBaseline(applied.slice(0, -2)),
  );
  for (const rows of [
    applied.slice(0, -3),
    [],
    [...applied, applied[0]],
    [{ ...applied[0], checksum: 'tampered' }],
    [{ ...applied[0], finished_at: null }],
  ]) {
    assert.throws(() => requireMarketplaceBaseline(rows));
    assert.throws(() => requireMarketplacePermissionBaseline(rows));
  }
});
