import { migrationManifest } from '../../src/lib/production/migrations';
import {
  migrationsReady,
  type MigrationRow,
} from '../../src/lib/production/readiness';

/** A task-specific local deploy must never apply unrelated pending baseline work. */
export function requireMarketplaceBaseline(rows: MigrationRow[]) {
  return requireOnlyPending(rows, ['20261118090000_marketplace_m1']);
}

export function requireMarketplacePermissionBaseline(rows: MigrationRow[]) {
  return requireOnlyPending(rows, [
    '20261118100000_marketplace_permission',
    '20261118101000_marketplace_permission_capacity',
  ]);
}

export function requireMarketplacePageBaseline(rows: MigrationRow[]) {
  return requireOnlyPending(rows, ['20261118110000_marketplace_page_content']);
}

export function requireMarketplaceEditorialBaseline(rows: MigrationRow[]) {
  return requireOnlyPending(rows, [
    '20261118120000_marketplace_editorial_versions',
  ]);
}

function requireOnlyPending(rows: MigrationRow[], allowed: readonly string[]) {
  if (!migrationsReady(rows, false))
    throw Error('Local history must match the approved release prefix.');
  const applied = new Set(
    rows.filter((row) => !row.rolled_back_at).map((row) => row.migration_name),
  );
  const pending = migrationManifest.filter(
    (migration) => !applied.has(migration.name),
  );
  if (pending.some((migration) => !allowed.includes(migration.name)))
    throw Error(
      'Apply the approved baseline separately; this command permits only its exact Marketplace migration pending.',
    );
  return pending.map((migration) => migration.name);
}

export function requireMarketplaceEnrollmentBaseline(rows: MigrationRow[]) {
  return requireOnlyPending(rows, [
    '20261119090000_marketplace_enrollment_intents',
  ]);
}

export function requireMarketplaceCommerceBaseline(rows: MigrationRow[]) {
  return requireOnlyPending(rows, [
    '20261119100000_commerce_permissions',
    '20261119101000_marketplace_commerce',
  ]);
}

export function requireMarketplaceDeliveryBaseline(rows: MigrationRow[]) {
  return requireOnlyPending(rows, [
    '20261119110000_delivery_permission',
    '20261119111000_marketplace_delivery',
    '20261119112000_delivery_provenance_constraint',
  ]);
}

/** Follow-up may apply only its one new migration after the approved 23. */
export function requireMarketplaceLearnerBaseline(rows: MigrationRow[]) {
  return requireOnlyPending(rows, [
    '20261119113000_marketplace_learner_capability',
  ]);
}
