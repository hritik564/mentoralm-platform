# Admin A4 Governance and production readiness

A4 implements the owner-approved governance checkpoint over the existing unified Clerk identity and MentoraLM PostgreSQL User. A4 is complete. This document records the final architecture and executed validation evidence. Production was not connected, migrated or bootstrapped. No deployment, push or Mobile LMS work is authorized by this phase.

## 1. Authorization architecture

Every Admin domain request requires Clerk session → existing MentoraLM User → effective persisted ADMIN → AdminAuthorization → GOVERNANCE or explicit required permission → domain/resource validation. Policy alone cannot grant Admin access. Primary persona remains `User.role`; additional roles remain `UserRoleAssignment`. There is no Clerk-metadata authorization, email allowlist, runtime compatibility fallback or ACCESS_MANAGE permission.

A missing policy or SCOPED empty permissions permits only the Admin entry/no-permissions surface. GOVERNANCE includes all twelve operational/read capabilities while storing an empty permission array. Operational services recheck authority in their transaction. Reads use fresh persisted policy, never a global policy cache; the request-local session resolver caches identity only. Sidebar and page availability use the server-supplied capabilities for presentation; API/service authorization is independent. Overview omits unauthorized queries and fields, including audit activity. Existing open pages may show an old navigation snapshot until refresh, but subsequent data/actions reauthorize immediately.

## 2. Complete permission map

All rows also require effective ADMIN. No alternate generic Admin endpoint bypasses these services.

| API / service family                                                                                                                                              | Required capability                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET `/api/admin/overview`, GET `/api/admin/operations/overview`                                                                                                   | Each metric/query individually filtered by its owning permission; no-policy returns empty projection              |
| Student list/detail/effective LMS context, Student override, Enrollment mutation                                                                                  | STUDENTS_MANAGE; Batch-member effective context also allows BATCHES_MANAGE                                        |
| Batch list/detail/save/access, membership, instructor assignment, Live Session creation/update, recording lifecycle/reconciliation                                | BATCHES_MANAGE                                                                                                    |
| A2 `/api/admin/academic/**`, Program/Course/Section/item catalog and authoring, subtype publication, question banks/questions, academic attachment/reconciliation | ACADEMICS_MANAGE; Live Session occurrences additionally invoke BATCHES_MANAGE service                             |
| Attendance queue/session/save, shared Admin attendance writes                                                                                                     | ATTENDANCE_MANAGE                                                                                                 |
| Submission queue/detail/review/private-file inspection, Attempt queue/detail/manual review                                                                        | ACADEMICS_MANAGE                                                                                                  |
| Certificate queue/detail/policy issue/suspend/restore/revoke, shared Admin revoke                                                                                 | CERTIFICATES_MANAGE                                                                                               |
| Discussion queue/detail/moderation                                                                                                                                | DISCUSSIONS_MANAGE                                                                                                |
| Support queue/detail/reply/status                                                                                                                                 | SUPPORT_MANAGE                                                                                                    |
| Communications queue/detail/audience/plan, shared Admin audience/preference writes                                                                                | COMMUNICATIONS_MANAGE                                                                                             |
| Referrals list/detail                                                                                                                                             | REFERRALS_VIEW; no mutation                                                                                       |
| `/api/admin/governance/users` and user detail                                                                                                                     | USERS_VIEW                                                                                                        |
| `/api/admin/governance/instructors`                                                                                                                               | BATCHES_MANAGE; inspection only                                                                                   |
| `/api/admin/governance/audit`                                                                                                                                     | AUDIT_VIEW; sanitized read only                                                                                   |
| `/api/admin/governance/settings`                                                                                                                                  | SETTINGS_VIEW; sanitized read only                                                                                |
| Additional role and Admin policy mutations                                                                                                                        | GOVERNANCE; read permissions cannot mutate authority                                                              |
| Selected bulk LMS override                                                                                                                                        | STUDENTS_MANAGE before dispatch and for each target transaction                                                   |
| Course/Program selectors                                                                                                                                          | Any of STUDENTS/BATCHES/ACADEMICS/ATTENDANCE/CERTIFICATES/DISCUSSIONS capabilities; titles/opaque references only |
| Instructor/LIVE_SESSION selectors                                                                                                                                 | BATCHES_MANAGE or ACADEMICS_MANAGE                                                                                |
| Batch selector                                                                                                                                                    | BATCHES/ATTENDANCE/DISCUSSIONS/COMMUNICATIONS; bounded names/opaque references only                               |

`src/lib/admin/permissions.ts` holds the closed trusted action registry. Unknown academic write actions deny. A1 services and recording transactions have explicit guards, including a fresh permission check and compare-and-set binding after an external recording-upload request; A3 operational reads use a closed area map. `/api/admin/academic/**` adds the academic route check as well as the service check. Shared LMS access, AcademicStaff and BatchCommunications use persisted permissions for their Admin branches. An assigned primary INSTRUCTOR retains its existing scoped teaching path on non-Admin-only calls, even with additional scoped ADMIN; that path never becomes unrestricted Admin authority. Admin-only calls still demand the corresponding Admin permission.

Student pickers/management links are shown only with STUDENTS_MANAGE. Certificate policy issue composition consequently requires Student-selection access in addition to certificate authority; the issue service itself requires CERTIFICATES_MANAGE and actual academic eligibility. Support-only Admins receive neither the Student management list nor unrelated Course/Batch metrics. Communication planning uses a minimal Batch selector rather than the management-list projection.

## 3. Governance and lockout safety

All role/policy writes use the shared PostgreSQL transaction advisory lock `(19748962, 4)` inside the existing serializable retry transaction. Actor/target roles, policy and unique remaining effective ADMIN+GOVERNANCE Users are read again inside it. Expected role-state digest and policy UUID revision prevent stale submissions. Directory checks prevent promotion of a missing/locked identity to GOVERNANCE. Primary persona changes are unavailable.

Self-demotion and removal of one's own effective Admin assignment are rejected. Another Governor must perform them; final unique Governor removal/demotion is also rejected. Concurrent mutual revocation/demotion cannot leave zero Governors. Audit failure rolls back the role/policy mutation.

Granting additional ADMIN to a non-Admin atomically adds the assignment and creates/resets SCOPED empty policy/new revision. Revocation of the assignment supplying effective ADMIN removes policy atomically after lockout checks. Regrant never revives earlier permissions/GOVERNANCE. A historically missing policy can only be explicitly initialized SCOPED by a Governor with expected null revision; it cannot silently become GOVERNANCE.

## 4. Local owner bootstrap

Repeatable local-only command:

```sh
npm run dev:admin-governance -- <existing-exact-email-or-Clerk-user-id>
```

The command resolves the existing Clerk Development identity, verifies actual `mentoralm_dev/public`, requires existing effective ADMIN and an existing policy, and refuses transfer if a different effective Governor already exists. Email is only operator identity resolution. Runtime authorization uses persisted User/roles/policy. It creates no Clerk identity/User/ADMIN assignment and never changes primary persona/history. SCOPED → GOVERNANCE and the audit insert share the governance transaction; repeating it is an audited no-op.

Executed for the existing owner `arcaderobo3@gmail.com`: changed=true, then changed=false on repetition. Primary STUDENT and additional ADMIN preserved. Student-history digest before/after: `fa79fe67608e51e71bb844c3d340cd302ad5bc9043e2fa6f894efdbab4f94b94`. One Development additional ADMIN, zero primary Admins, zero A1 fixture Batches/Courses. The bootstrap implementation lives in trusted scripts and has no HTTP route.

## 5. Approved additive migration and backfill

`20261003010000_admin_a4_governance` adds:

- AdminAuthority SCOPED/GOVERNANCE and the twelve approved AdminPermission values.
- AdminAuthorization: User PK/FK, authority, permissions[], UUID revision, createdAt/updatedAt TIMESTAMPTZ(6), authority/user index; restrictive User FK and User inverse.
- Immutable `valid_admin_permissions` SQL helper/CHECK: no null, null elements, duplicates, more than twelve or multidimensional nonempty arrays. GOVERNANCE must store an empty array.
- Migration-time SCOPED backfill with exactly the nine A1–A3 operational capabilities for existing primary/additional Admins. No USERS_VIEW/AUDIT_VIEW/SETTINGS_VIEW/GOVERNANCE backfill; no runtime fallback.
- AcademicAudit descending createdAt/id, actor/time/id and action/time/id indexes; UPDATE/DELETE row guard and TRUNCATE statement guard.

No Role changes, primary-persona rewrite, learning-history rewrite, Instructor FK changes or settings table. `npm run db:migrate:a4:local` checks Development identity/loopback/Clerk Development configuration before Prisma deployment. Applied successfully only to local `mentoralm_dev/public`; all eleven migrations finished. Clean and populated upgrades execute in disposable schemas of isolated `mentoralm_test`. Guarded schema drift check reports no difference.

## 6. Audit immutability

Audit inserts remain allowed; SQL UPDATE, DELETE and TRUNCATE fail. Existing history survives upgrade. Before migration, A1/A2 browser fixture cleanup was moved to disposable Test schemas, with schema/actual database checks. Local seed reset now appends LOCAL_OWNER_SEED_RESET; latest seed/reset lifecycle events allow safe reseeding without deleting history. No application update/delete/truncate/bypass endpoint exists.

The guard is an application/database invariant, not protection against a PostgreSQL superuser. True emergency/legal repair requires an offline privileged operator, separate change-control approval, independent preservation/export and externally retained operator evidence. There is no online break-glass UI or hidden application bypass.

## 7. Users & Access and Instructor inspection

Existing identities are searchable and paginated (20/page), with primary persona/effective-role filters, Clerk-derived display identity/status, additional roles, Student ID and relevant LMS/Enrollment/membership summary. User detail separates primary persona, additional roles and Admin policy. Governance-only dialogs require reason/confirmation and stale-state/revision checks. USERS_VIEW alone is read-only. Opaque typed routing references replace internal database/Clerk IDs.

Instructor inspection uses existing User roles and BatchInstructor assignments. Primary INSTRUCTOR is required by the unchanged composite teaching FK. Additional INSTRUCTOR alone on a primary Student never grants eligibility; UI states that explicitly. No second Instructor identity/model or persona conversion exists.

## 8. Audit explorer

Read-only paged explorer filters actor (select the displayed actor), operation, category, target type and inclusive date range. Closed registry supplies safe labels and target descriptions. Registered User targets resolve to display name/Student ID; registered Batch, Live Session, Course, Program, Section and Learning item targets resolve to bounded names/titles. Unknown actions never trigger target-model lookup. These lookups operate only over the current twenty-row page; summaries accept only bounded approved enum/boolean/numeric before/after fields. Raw details, internal target IDs, storage references, credentials, URLs, response/Support bodies and arbitrary reason text never reach the explorer. Historical unknown operations display only safe operation/time/actor envelope, with no guessed target type.

## 9. Settings readiness

Read-only Platform/Learning/Communications/Media/Security groups show approved static domains and safe readiness states. No settings table, write route, credential entry or raw environment/connection/private-path values. Configured does not imply Production deployment. Missing storage/streaming/scanning/certificate and sending providers remain honestly not configured.

## 10. Bulk controls

Only selected Student LMS overrides are added. Maximum fifty distinct targets, explicit row selection scoped to the current filter/page, confirmation and reason. Each target freshly authorizes/validates in its own transaction; successful overrides and permitted failures append outcomes. UI reports saved/failed selections and useful per-target failure text. No global database select-all, primary-role bulk mutation or Enrollment/communications mass send exists. A failed audit rolls back its mutation; unexpected infrastructure failures do not claim a successful result.

## 11. Security review

Strict Zod and typed opaque handles reject forged actors/roles, unexpected fields, invalid references, oversized bodies and stale versions. Same-origin JSON, trusted-host/domain routing, approved redirect paths, process-local rate bounds and private/no-store responses remain. Missing/revoked ADMIN/policy/permission affects subsequent requests immediately. Private-file parent and academic permission checks remain independent of UI hiding. Student LMS entitlement, Enrollment, Course/publication/Batch ownership remain mandatory, and Admin roles never substitute for them. No weakening of Clerk/session/logout/redirect validation.

## 12. Validation results

All required checks passed. Prisma validation, typecheck, lint (zero warnings), Prettier check, production build, `git diff --check` and guarded Development schema-drift verification passed.

| Executed suite                                                           | Result                          |
| ------------------------------------------------------------------------ | ------------------------------- |
| Combined PostgreSQL/domain: A1/A2/A3/A4, role migration, D4, L1/L2/L3/L4 | 158 passed; zero failed/skipped |
| Final focused A4 after audit-target readability change                   | 21 passed; zero failed/skipped  |
| A1 Playwright                                                            | 2 passed                        |
| A2 Playwright                                                            | 2 passed                        |
| A3 + Clerk account-switch Playwright                                     | 3 passed                        |
| A4 full Playwright                                                       | 3 passed                        |
| Final Audit/dialog focused Playwright                                    | 1 passed                        |
| D4 Playwright desktop/mobile                                             | 6 passed; 2 intentional skips   |
| L3 Playwright desktop/mobile                                             | 4 passed                        |
| L4 Playwright desktop/mobile                                             | 4 passed                        |

The two D4 skips are missing-database UI cases that only run when the test database is unconfigured; populated persistence/ownership cases ran with the configured isolated database. The final focused A4 suite revalidated the only subsequent production change (Audit target description and wrapping); the other domain/regression suites were already conclusively complete. No test weakens production authentication to switch accounts.

Security assertions cover populated migration/backfill/history, clean install, permission CHECKs, no-policy/policy-without-role denial, all scoped operational permissions, shared-service bypass attempts, Student/Admin coexistence, Instructor restrictions/coexistence, governance concurrency/last-governor/self-demotion, stale state/revision/revocation, regrant, audit rollback, owner idempotence, seed lifecycle, immutable audit and sanitized projections. Browser cases cover forged actors, mass assignment, origins/hosts, oversized bodies, stale policies, revocation, empty-policy surface, scoped navigation/data and logout. A1–A3 and Student regressions retain IDOR/private-file/parent ownership/redirect checks.

Review evidence and logs are retained in the ignored `docs/reviews/admin-a4/` directory. Owner Development read-only verification returned 200 for Overview, Users, Audit and Settings, without business mutations. The owner Student-history proof compares the same digest and counts before/after browser execution.

## 13. Visual review

Ignored review directory: `docs/reviews/admin-a4/`. Required final Views: Overview, Users & Access, User Detail/role management, Audit Logs, Settings; representative Students/Course Builder/Attendance/Support and Instructor inspection. Widths 1440, 1024, 820 and 390, light/dark. Eighty page captures cover ten views × four widths × two themes, with zero WCAG 2 A/AA and WCAG 2.1 AA axe violations. The final Audit pass refreshes its eight captures; two additional 1440 role-management dialog captures also pass axe. Actual Development-owner Users and Audit captures are retained separately. `capture-manifest.json`, `axe-results.json` and `axe-audit-dialog-final.json` record completed checks; dialogs use the existing native focus-trapped DashboardDialog with Escape/focus restoration. Tables scroll within their containers.

## 14. Future first Production Governor procedure (documentation only)

The local CLI intentionally refuses Production and must not be repurposed by removing its guard. A future separately reviewed trusted server/operator job must:

1. Require approved Production change control, verified target database identity, backups and least-privileged credentials supplied by the deployment secret manager.
2. Require an already authenticated/provisioned existing MentoraLM User and already persisted effective ADMIN. Resolve a verified Clerk Production subject to User ID; email is never runtime authority. Establish the initial ADMIN assignment through a separately approved trusted provisioning process if it does not yet exist; this procedure must not implicitly grant it.
3. Start the same serializable transaction and governance advisory lock. Re-read User/effective ADMIN/policy; require an existing SCOPED policy, and count unique effective Governors.
4. Only when there are zero effective Governors, change that exact policy to GOVERNANCE with empty permissions and fresh revision. Insert a concise operator/change-ticket/bootstrap audit in the same transaction. Failure rolls back.
5. If the same initialized identity repeats, return an audited no-op only under the recorded bootstrap identity/change control; never transfer to another target if any Governor exists. Further transfers/role changes use normal governed services with lockout protection.
6. Retain operator evidence outside application audit, verify the authorized Admin surface and denied non-Admin access, and recheck primary persona/Student history. Never expose an HTTP first-admin endpoint or browser bootstrap secret.

This procedure was not executed against Production.

## 15. Remaining roadmap / infrastructure

Production requires Clerk Production domain/session configuration; DNS/TLS for the three approved domains; PostgreSQL pooling/backups/restore/least privilege; private object storage; file malware scanning; private video provider and verified callbacks; certificate document rendering if desired; approved email/WhatsApp/in-app delivery adapters; distributed rate limiting; centralized observability/error tracking and provider cleanup/reconciliation scheduling. Application controls cannot substitute for an independent deployment/security review.

Zoom automation, Menti AI Tutor, Quantum Engine, payments, analytics warehouse, Mobile LMS, certificate designer and public certificate verification remain deferred. No provider sends, Production connections, deployment or push occurred. There is no remaining known A4 application blocker; Production infrastructure remains intentionally unconfigured.

The complete changed-file manifest is [ADMIN-A4-FILES.md](ADMIN-A4-FILES.md) (66 files, including this report and regression-fixture changes).
