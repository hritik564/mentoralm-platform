# Admin A1 completion report

A1 implements the operational control plane in the existing Next.js application with the same Clerk instance, PostgreSQL database, User, Student ID and LMS models. No production connection, deployment, DNS modification, push or A2 implementation.

## Implemented surfaces

| Area          | Delivered behavior                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routing       | Local `/admin`, `/admin/students`, `/admin/batches` and opaque detail references; native `admin.mentoralm.com` short paths via the shared domain abstraction. Native `/sign-in` maps to internal Admin entry. Trusted host and safe return allowlists apply.                                                                                                                                                      |
| Authorization | Clerk session → existing MentoraLM User → effective persisted roles (primary role plus UserRoleAssignment) → ADMIN. Rechecked for repository reads, each mutation transaction and recording operations; Clerk metadata/client role or actor claims never grant access. Users without effective ADMIN and unprovisioned identities cannot access Admin data. Primary Student/Instructor personas remain unchanged. |
| Shell         | Dedicated navy sidebar, Overview/Students/Batches operational links, disabled future destinations, honest unavailable global search, shared theme toggle/account/logout. Desktop and collapsible mobile navigation.                                                                                                                                                                                               |
| Overview      | Real Student/effective-LMS-access/active-Batch/Enrollment/published-Course/open-Support counts; real recent audit activity, access attention panel and learning snapshot. No invented historical charts, reviews or activity.                                                                                                                                                                                     |
| Students      | Server-side name/email/Student ID search, access filters, 20-row pagination, real Clerk identity projection. Read-only personal/learning information, current Batch, Enrollments, memberships and recent audit. No internal User/Clerk IDs in displayed data.                                                                                                                                                     |
| LMS access    | Explicit INHERIT/ENABLED/DISABLED control and independent effective result/source. Disabled confirmation. Shared entitlement service remains authoritative; Batch changes never rewrite individual overrides.                                                                                                                                                                                                     |
| Enrollments   | Add Course Enrollment, supported ENROLLED/IN_PROGRESS changes and confirmed removal through existing service; COMPLETED cannot be manufactured by Admin. Course completion/assessment/certificate facts remain learning-domain responsibilities.                                                                                                                                                                  |
| Batches       | Search, status filter, pagination, create/edit existing code/name/status/scope/dates and LMS access. Existing database scope rule permits either Program or Course, not both. Membership and Enrollment remain separate.                                                                                                                                                                                          |
| Memberships   | Paged real members, add/deactivate/reactivate, joined/left/status and effective access. Reactivation preserves existing original join date; a single existing membership interval is retained, not an invented membership-history model.                                                                                                                                                                          |
| Instructors   | Assign/remove existing persisted INSTRUCTOR users through BatchInstructor; bounded searchable identity choices. Session-level Instructor is independently validated for role and same-Batch assignment. Historical attribution survives removal of Batch assignment.                                                                                                                                              |
| Live Sessions | Create/edit title, existing Course/LIVE_SESSION context, optional assigned Instructor, start/end, status, location and approved external meeting-target ID. No authoring or Zoom integration. Published recording/attendance context and session start cannot be silently rebound.                                                                                                                                |
| Recordings    | Metadata-only lifecycle, private adapter contract, readiness/publication gate, revision checks, transactional audit and durable cleanup/reconciliation foundation. UI shows real NO_RECORDING/status/metadata/cleanup states. Upload/publish/delete/replace/retry remain unavailable without an installed private provider. Existing publication can be withdrawn without that provider.                          |

Details use bounded collections: latest 50 Live Sessions; up to 100 student Enrollments/memberships; 50 choice results; 8 Overview/10 student audit events. Members and main lists are paginated. These bounds are intentional V1 limitations; no unbounded identity directory scan. Broad Clerk searches above 100 matches require a narrower query. Global/bulk/role-management tools are deferred.

## Approved schema and migration

Migration: `prisma/migrations/20261002180000_admin_a1_recordings/migration.sql`.

- Adds `BatchSessionRecordingStatus`: UPLOADING, PROCESSING, READY, PUBLISHED, FAILED.
- Adds one `BatchSessionRecording` row per session, sessionId PK/FK, unique revision UUID, storageProvider/opaque assetRef, title/description/fileName/mimeType/bytes/duration metadata, readyAt/publishedAt/cleanupRequestedAt and timestamps.
- Unique provider/asset reference; lifecycle/updatedAt and cleanup-request indexes.
- Five SQL CHECK constraints: nonempty non-URL references, positive byte count, nonnegative duration, READY/PUBLISHED readiness evidence, publication timestamp/status consistency and no publication during cleanup.
- Nullable `BatchSession.instructorId` → existing User with RESTRICT deletion/update, instructor index and Prisma inverse relations. No Instructor identity model.
- No destructive statements or backfill. Existing sessions retain NULL Instructor and no recording row. Other domain columns/data remain intact.

Applied to loopback `mentoralm_dev/public`. Clean `mentoralm_test` disposable schemas apply all eight migrations; populated seven-migration baseline upgrades successfully and preserves Student IDs, Enrollments and sessions. Database-test guards reject the Development URL and verify the actual test database before creating/dropping only the isolated schema. No development database reset or test-schema cleanup targets production.

Exact fields/relationships and lifecycle contracts: [recording verification](ADMIN-A1-RECORDING-VERIFICATION.md).

## Recording authorization and storage

Clerk session → shared Student User → LMS entitlement → Enrollment in canonical Course → published Course/Section/LIVE_SESSION → exact Batch membership → PUBLISHED, ready, non-cleanup recording → controlled media delivery.

Exact-Batch membership permits either the joinedAt/leftAt window covering session start, or currently ACTIVE membership in that same Batch. Later joiners can catch up. Another Batch, individual entitlement alone, or attendance PRESENT never grants access. Playback performs no AttendanceRecord or LessonState write; ABSENT remains ABSENT.

`storageProvider` names a server-owned adapter. `assetRef` is its private object key or provider asset ID, not a playback URL. No signed URLs, public object locations, credentials or video bytes are persisted. Delivery must reauthorize and use private range streaming or short-lived asset-scoped tokens; responses are private/no-store. Already buffered bytes/issued tokens cannot be recalled; provider expiry/revocation policy bounds remaining access.

UPLOADING is durable before external initialization. Revision supplies idempotency, reconciliation and stale callback rejection. Trusted provider inspection moves PROCESSING → READY, or confirmed failure → FAILED. Publication requires persisted READY plus fresh provider readiness; client bodies cannot set readiness or provider references.

Replacement first unpublishes and commits cleanup intent/audit. The old row/reference remains until private asset/upload-reservation deletion is confirmed. Failure leaves durable cleanup pending and blocks playback/publication/new upload. Confirmed deletion removes only the recording row and appends completion audit; a subsequent upload gets a new revision/asset. Only one active/published recording exists per session. Adapter deletion must cancel/fence late creation for the same revision; immutable assets and signed callback verification are required. No provider/worker is installed, so real upload/processing/streaming is explicitly deferred infrastructure within the approved foundation scope.

## Audit and security

Access, Enrollment, Batch, membership, Instructor, Live Session and recording mutations use persisted actor identity and transactional AcademicAudit with target/time/before/after or lifecycle intent/completion. Metadata auditing records change indicators rather than large descriptions. UI audit summaries omit internal actor/target IDs; protected database audit records retain them for future authorized investigation.

Strict whitelisted Zod bodies, opaque typed routing handles, exact target-role/context checks, same-origin JSON, 16KB body limit, private/no-store responses and existing mutation-rate limiting protect the boundary. Handles are routing identifiers, never bearer authorization. They use the existing server secret, are stable per typed identifier and invalidate on secret rotation. No new credential/environment secret is introduced.

## Files changed for A1

- `prisma/schema.prisma`; approved recording migration.
- `src/lib/admin/{session,directory,handles,http,validation,repository,operations,recordings}.ts`.
- `src/app/admin/**`, `src/app/admin-auth/**`, `src/app/api/admin/[...path]/route.ts`, `src/app/api/lms/recordings/[sessionId]/route.ts`.
- `src/components/admin/**`; `src/styles/admin.css`.
- Shared `src/lib/platform/domains.ts`, `src/proxy.ts`, `src/lib/lms/access-admin.ts`; shared theme cookie approved-host list in `src/components/dashboard/theme/DashboardTheme.tsx`.
- `.env.example`; `scripts/admin-a1/migrate.ts`; Admin test scripts/config/tests; historical `tests/helpers/l3-fixtures.ts` select list for pre-A1 upgrade compatibility.
- This report and schema/recording checkpoint documents; generated visual captures.

Earlier LMS/UI/auth/theme work already in the workspace is retained and is not represented as new A1 implementation.

## Validation and visual review

Final executed checks:

| Check                                                                     | Result                                                                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Prisma validation/generation                                              | PASS                                                                                                                              |
| Typecheck, lint, format check, git diff whitespace check                  | PASS                                                                                                                              |
| Production build                                                          | PASS                                                                                                                              |
| Combined A1 migration/domain + relevant L4/LMS auth/account domain suites | 21 passed; 0 failed; 0 skipped                                                                                                    |
| Final focused Admin Playwright run                                        | 2 passed; 0 failed                                                                                                                |
| Representative axe                                                        | 12 analyses across Overview/Students/Student Detail/Batch detail at 1440/820 in both themes; 0 violations                         |
| Responsive/visual captures                                                | 16 captures in light/dark at 1440, 1024, 820 and 390; no document overflow                                                        |
| Guarded development verification                                          | All 8 migrations finished, none rolled back; Prisma reports “No difference detected”                                              |
| Post-test cleanup                                                         | 0 temporary A1 Batches/Courses and 0 primary ADMIN users at initial A1 completion; fixture-only Clerk identities and data removed |

Executed: `npm run db:validate`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, `git diff --check`, `npx tsx scripts/admin-a1/verify.ts`, `NODE_OPTIONS=--conditions=react-server npx tsx --test tests/admin-a1-domain.test.ts tests/admin-a1-migration.test.ts tests/l4-domain.test.ts tests/lms-auth-domain.test.ts tests/lms-account-domain.test.ts`, and `npm run test:a1`.

The existing pg adapter emits a non-failing concurrent-client-query deprecation warning in the L4 suite; application checks pass. No dependency upgrade is included in A1. Focused domain coverage includes persisted-role denial/revocation, strict inputs, pagination/search, entitlement precedence, Enrollment independence, membership changes, Instructor authority/same-Batch assignment, session IDOR, historical restriction, audit, recording concurrency/readiness/stale revisions, exact-Batch historical/current access, failed cleanup/retry/replacement, and unchanged attendance/progress. Clean/populated migration tests verify CHECK/FK behavior and preservation. Relevant L4 and LMS account/auth domain regressions are included because shared access/routing code changed.

Initial A1 authenticated browser tests use temporary Clerk **Development** identities and corresponding real local PostgreSQL fixtures, never the owner's role/account. Fixture identities, data and audit events are removed after testing; Student ID sequence gaps are expected and are not reset. No production records or fixed fake display metrics are used.

Captures: `docs/reviews/admin-a1/{light,dark}-{1440,1024,820,390}-*.png`. Required Overview/Students/Student Detail/Batch Live Sessions desktop and 820 list/detail states are captured, with extra 1024/mobile states. Representative axe checks cover both themes at 1440 and 820; every captured viewport checks document overflow. Native dialog Escape/focus return, retained detail tabs, mobile disclosure and logout are exercised.

Requested alias `Reference/Admin-A1-Overview-Students-Batch.png` was absent. The supplied matching four-panel reference `Reference/ChatGPT Image Oct 2, 2026, 04_22_06 PM.png` was visually inspected and used for direction. Navy sidebar, compact tables/cards/tabs, restrained purple accents and real-data empty states preserve that composition.

## Production requirements and exact deferrals

- Set approved website/LMS origins plus `NEXT_PUBLIC_ADMIN_ORIGIN=https://admin.mentoralm.com`; route all three approved hosts to the same application. Configure shared Clerk production domain/session/redirect settings and authorized parties. No DNS/deployment was performed.
- Owner access is now provisioned locally through the approved additional ADMIN assignment. Primary STUDENT and existing learning history are preserved. See [owner multi-role report](ADMIN-OWNER-MULTI-ROLE.md) for the guarded operator CLI and real-owner validation. Production provisioning is a separate authorized operation; the local CLI rejects production. A1 has no role-promotion UI.
- Integrate private storage readiness, safe multipart/provider uploads, immutable revision-correlated assets, signed callbacks, cancellation/deletion fencing, reconciliation/retry runner, abandoned-upload expiry, controlled delivery and short token expiry/revocation. Keep storage credentials server-only. No vendor chosen or unsafe local video workaround.
- Existing mutation limiting is process-local; production multi-instance enforcement needs shared rate-limit infrastructure. No analytics warehouse or background queue was invented.
- A2: Course/Section/Lesson and question/quiz/assessment/assignment authoring. Later phases: Attendance administration, expanded grading/review, certificate management, discussion moderation, Support operations, communications sending, referrals, users/roles/granular permissions, full audit explorer, global settings. No Zoom API, Menti/Quantum AI, payments, or recording-watch progress persistence.

A1 stops at this operational foundation. A2 remains unstarted.

## Owner multi-role follow-up

The approved additive `20261002190000_user_role_assignments` migration adds only the assignment table/FK/index. Central effective-role resolution protects every existing Admin branch, including LMS staff services; Instructor semantics and Student entitlement/Enrollment remain unchanged. The follow-up uses the existing owner identity and existing business data. [Final verification and captures](ADMIN-OWNER-MULTI-ROLE.md).

## Subsequent academic authoring

A1 remains the operational foundation. The separately approved A2 enables Programs & Courses, Assessments and Assignments in the same shell and reuses A1 session/recording/role services. See [Admin A2 completion report](ADMIN-A2.md); the A1 scope statements above describe its original checkpoint.
