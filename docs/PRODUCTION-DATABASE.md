# Production PostgreSQL, migration and recovery

One future independent Neon PostgreSQL database in AWS ap-southeast-1 (Singapore) serves Website/Dashboard/LMS/Admin. No Production connection, backup or restore was performed in P1. Local Development remains mentoralm_dev; integration tests require loopback mentoralm_test and verified disposable `d4_24hex` schemas. P1 adds no migration/schema change.

## Release baseline

Eleven chronological migrations are locked by name and SHA-256 in `src/lib/production/migrations.ts`; offline preflight verifies the files. P1 tests run clean installation, Prisma drift comparison, and upgrade from a populated earliest foundation. A4 tests separately preserve academic/attendance/certificate/audit history from its populated historical baseline.

| Migration                               | Purpose                                               |
| --------------------------------------- | ----------------------------------------------------- |
| 20261001000000_student_foundation       | Unified User/Dashboard foundation                     |
| 20261001005000_instructor_role          | Existing Instructor persona                           |
| 20261001010000_lms_foundation           | LMS hierarchy/cohorts/Student ID                      |
| 20261001020000_lms_entitlement          | Business LMS entitlement                              |
| 20261001030000_lesson_delivery_progress | Lesson delivery/state                                 |
| 20261001100000_academic_engine          | Assessments/assignments/attendance/certificates/audit |
| 20261001120000_lms_integration          | Discussions/communication plans/events                |
| 20261002180000_admin_a1_recordings      | Session instructor and recording metadata             |
| 20261002190000_user_role_assignments    | Additional persisted roles                            |
| 20261003000000_admin_a3_operations      | Response review and certificate hold                  |
| 20261003010000_admin_a4_governance      | Admin policy and immutable audit                      |

No db-push dependency, development fixture SQL, hardcoded database host or destructive pending schema diff exists. Historical LMS migration fills only missing Student IDs through the existing sequence/trigger, preserving existing IDs. A4 migration backfills only nine operational scoped capabilities, not GOVERNANCE. Custom SQL checks/triggers are intentional and remain enforced; Prisma structural drift alone does not validate every trigger body.

Runtime uses a singleton PrismaPg pool per process. Explicit verified TLS relies on public system CA trust, authenticated connection and public schema. The selected topology uses direct Neon endpoints for both runtime and the separate operator job. A conservative pool of 8 (configurable 1–30), 5-second connect, 10-second idle and 10-second query/statement bounds preserve existing pg/Prisma transactions, serializable isolation, session/transaction advisory locks and named prepared statements. Transaction poolers are refused. Actual Neon capacity, cold start, TLS and grants require later verification. Readiness checks actual database/schema, names/checksums and enabled audit guards. No connection is opened at build/startup just to migrate/seed.

## Pre-deploy backup evidence

Record target cluster/database/schema, backup identity, UTC timestamp, encryption/retention/access controls, source release commit, eleven-migration baseline/checksums, schema version and restore-test evidence. Take a fresh backup before migrations; opaque references belong in operator records. Do not store backup bytes or connection secrets in the app repository. Verify adequate destination storage/version/extensions/role/grant compatibility, recovery credentials, maintenance/traffic plan and write-loss window. Backup metadata alone does not establish restorability.

## Neon-native recovery and initial database

Neon documents a default neondb and system-owned postgres database. Use a distinct empty application database such as mentoralm_prod/public, not postgres. Its metrics extension is documented in postgres; no generic public-schema extension exemption is granted. Preflight rejects any unbaselined public relation/function/type/extension/collation/operator/conversion, while ignoring unrelated/system namespaces. Unexpected provider-created public objects require stopping and reporting. [Neon databases](https://neon.com/docs/manage/databases), [Neon extension](https://neon.com/docs/extensions/neon).

Neon instant restore and historical branching depend on the subscribed/configured history window. Current documented defaults are 6 hours on Free and 1 day on paid plans; Launch permits up to 7 days, Scale up to 30. Confirm actual plan/window/cost before creation. Restore into an isolated branch/database for verification before any approved cutover; do not run an in-place restore that silently discards audit history. No Neon recovery feature was exercised in this task. [Neon history](https://neon.com/docs/introduction/branching).

## Ongoing policy to approve with provider

Start with subscribed Neon point-in-time/history recovery plus **independent daily pg_dump custom-format backups**, encrypted outside Neon/Replit, approximately 30-day daily retention and separately protected monthly retention where business/legal requirements justify it. Use a direct endpoint with libpq verify-full and a maintained CA bundle (PGSSLROOTCERT); do not reuse Prisma-specific sslaccept in libpq. Store role/grant recovery evidence separately without exporting credential values into logs. Run the backup job outside the serving process; no P2 LMS storage is implied. These are proposed starting values; the owner must choose RPO/RTO, residency, legal retention and costs. Restrict restore/download/decrypt access; separate key access from backup access; monitor failures/age/storage and rehearse an isolated restore before launch and monthly initially. Do not expose dumps in public storage or app media paths.

## Isolated restore drill

1. Verify an isolated NON-Production target and unique credentials/network isolation. Disable outward provider delivery/jobs; do not run local seed/reset tooling against a remote restore target.
2. Use the selected provider's documented restore/export method and matching PostgreSQL tools. Preserve sequences, indexes, SQL functions/triggers, relationships, timestamps and migration metadata. Restore ordering/permissions must accommodate historical audit inserts without deleting audit rows.
3. Validate `_prisma_migrations`: names, checksums, successful states and baseline. Verify migration structural drift plus custom CHECKs, immutable responses/reviews and audit UPDATE/DELETE/TRUNCATE guards.
4. Compare representative business counts and referential integrity: User/primary+additional roles, Student ID uniqueness/format/stability and next sequence allocation, profiles, Enrollments/status, Batches/memberships/instructors, published curriculum, lesson state, attempts/responses, submission versions/reviews, attendance, completion/certificates and communication/discussion/support records. Do not print private bodies.
5. Compare academic history digests/timestamps and AdminAuthorization authority/permissions/revision. Count unique effective Governors and verify scoped/empty-policy denial. Preserve complete AcademicAudit history; confirm guarded inserts and rejected UPDATE/DELETE/TRUNCATE.
6. Verify private object/video references against the independent provider asset inventory once P2 exists. Database backup does not back up media bytes.
7. Run isolated Student/Admin smoke tests with identities from an approved separate test strategy; never bypass business authorization. Record results, measured recovery time and unresolved failures. Do not claim the backup is valid until this drill succeeds.

## Recovery control

Emergency database-superuser/legal repair is an offline operator procedure with independent preservation/export, external approval/evidence and separate change control. A superuser can bypass triggers; no app break-glass endpoint exists. No Production audit deletion/cleanup is authorized. Recovery should normally restore into a replacement isolated database for validation before an approved cutover, with explicit reconciliation of activity after the backup.

Runtime/operator URL validation and TLS details: [Provider preparation](PRODUCTION-PROVIDERS.md). No Production backup, dump, restore, drift check or migration was executed. The existing eleven migrations remain the sole schema authority.
