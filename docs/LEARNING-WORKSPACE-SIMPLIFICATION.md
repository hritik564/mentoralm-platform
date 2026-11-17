# Learning workspace simplification

Completed 17 November 2026. This report describes only this Learning pass, compared with a snapshot of the already-approved, uncommitted Admin redesign. Earlier work was preserved. HEAD remains `da55937c27a8f88d7bd9b3c1b8151f2547e0d7ae`.

## 1. Files changed in this pass

Presentation:

- `src/app/admin/layout.tsx` — import scoped Learning styles only.
- `src/components/admin/AdminShell.tsx` — Learning child navigation renders only the existing four primary destinations; global sidebar unchanged.
- `src/components/admin/Workspaces.tsx` — delegate Learning presentation; People/Inbox rendering unchanged.
- `src/components/admin/LearningHome.tsx` — landing, real counts, actionable queues, current courses, narrow-role context picker.
- `src/components/admin/LearningDelivery.tsx` — selected-Batch class/recording groups using existing APIs.
- `src/components/admin/BatchDetail.tsx` — contextual tools, URL-backed section/session selection, scheduling intent.
- `src/components/admin/academic/Builder.tsx` — contextual Course navigation around the existing curriculum/editors.
- `src/components/admin/academic/CourseContext.tsx` — course-specific lists and existing workflow links.
- `src/components/admin/operational/List.tsx` — whitelist incoming Course/Batch/status/item/date filters for the four Learning operational lists. Other operational areas retain their previous initialization.
- `src/lib/admin/learning.ts` — pure presentation grouping; no server reads/writes or authority changes.
- `src/styles/admin-learning.css` — scoped Learning and contextual responsive presentation.

Tests:

- `tests/admin-learning.test.ts`
- `tests/admin-ui.spec.ts`
- `tests/helpers/admin-ui/data.ts`
- `tests/helpers/admin-ui/fixture.tsx`
- `tests/l1-domain.test.ts` — two synthetic rejection-input replacements only.

Documentation: this file, `docs/LEARNING-WORKSPACE-SIMPLIFICATION.md`.

The sidebar structure, backend services/API routes, permission registry and server guards, Clerk/authentication, governance/audit, schema/migrations, Students and Settings sources, and existing styles match the starting snapshot. People and Inbox presentation branches match their previous behavior. No baseline files were deleted.

## 2. New Learning structure

Landing subtitle: “Manage courses, batches, live classes and recordings.” Three permission-filtered creation actions: Create Course, Create Batch, Schedule Class. Exactly four primary areas: Courses, Batches, Live Classes, Recordings.

Counts reuse existing overview projections: published Courses, active Batches, all scheduled sessions (not falsely called upcoming), and READY recordings without pending cleanup. Unavailable counts use a dash rather than fabricated zeroes. Needs Attention shows positive authorized queues only; successful empty queues show “You're all caught up.” Assignment count includes SUBMITTED and UNDER_REVIEW, so its link opens the existing review queue without an incomplete status filter. Missing-attendance count links to the existing Held-session review workflow; that workflow also includes Held sessions with records because no zero-record-only filter exists.

Current courses show up to five existing catalog records, Program, Enrollment count, publication status and Open Course. The existing count includes all Enrollment statuses and is labelled accordingly. Exact active Batch counts per Course are absent from the existing projection, so they are not inferred or fabricated. Search/filter controls remain in Courses.

## 3. Old routes preserved

No route was removed or renamed. Existing Course/Batch details, `/admin/attendance` and its session details, `/admin/assignments`, `/admin/submissions` and review details, `/admin/assessments`, `/admin/question-banks`, `/admin/attempts` and review details, `/admin/certificates` and issuance/detail routes remain available under their unchanged server permissions. Old descendant URLs still select Learning in the sidebar. Course content and mutation payloads use the existing editors/services.

## 4. Attendance

Batch → Attendance opens the existing Batch-filtered attendance list and session-specific review routes. Course → Classes exposes Course-filtered attendance when authorized. Attendance-only administrators retain an authorized Course/Batch context selector on Learning; they receive no broader Course or Batch management grant.

## 5. Assignments

Course → Assignments lists that Course's existing assignment items and reuses ItemEditor. Review submissions opens `/admin/submissions?course=…`; All assignments retains the existing catalog. Batch → Assignments links through its canonical Course only. Program-only/unscoped Batches do not invent a Course association.

## 6. Assessments

Course → Assessments lists existing Quiz/Assessment items and opens the same ItemEditor. Review responses links to `/admin/attempts?course=…`. Existing assessment and question-bank catalogs remain linked from this context.

## 7. Certificates

Course → Certificates links to the existing Course-filtered certificate workflow, gated by CERTIFICATES_MANAGE. Certificate-only administrators retain the permitted Course context picker without being granted Course authoring access.

## 8. Live Classes

Choose an existing Batch, then view Today / Upcoming / Past using its existing most-recent-50-session projection. UTC grouping includes sessions overlapping the current UTC day, including cross-midnight classes. The page discloses its selected-Batch scope, UTC and 50-session bound. It does not claim an all-Batch feed. Rows show actual session title, linked learning-item context, instructor, start time and status. Course links appear only when present and authorized. Schedule Class opens the existing Batch SessionEditor; Open Class selects that same Batch session. No new scheduling backend or webinar integration was introduced.

## 9. Recordings

Within a selected Batch, existing sessions are grouped into Needs Publishing (READY), Published, and Processing / Unavailable. Missing recording rows and cleanup-pending states remain unavailable. Existing Batch metadata and unpublish controls are reused with unchanged mutation payloads. Upload/new publication/replacement/deletion remain honestly unavailable where storage is not configured. No fake upload, video URL, storage or publishing implementation was added; attendance is unchanged.

## 10. Old Student ID audit

No current application source or script introduces the old prefix. Two synthetic inputs changed to `ST-2026-000001`: `tests/l1-domain.test.ts:74` (invalid launch identifier) and `:89` (forbidden profile assignment). Their rejection assertions remain intact. Current Admin UI fixture IDs use ST format and now have an explicit format regression test.

Residual pre-existing references were left untouched:

| Location                                                            | Meaning                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `prisma/migrations/20261001010000_lms_foundation/migration.sql:177` | Applied historical issuer still emits the legacy prefix in this checkout. |
| Same migration `:187`                                               | Applied format CHECK still requires the legacy prefix.                    |
| `tests/l1-domain.test.ts:215`                                       | Current local database-issued-ID assertion, not synthetic input.          |
| `tests/lms-l1.spec.ts:143`                                          | Current local provisioned-user E2E assertion, not synthetic input.        |
| `tests/l1-domain.test.ts:815`                                       | Historical foundation/backfill preservation check.                        |
| `tests/production-p1.test.ts:486`                                   | Historical foundation-upgrade preservation assertion.                     |
| `docs/L1.md:6`, `docs/L4.md:12`                                     | Original implementation reports.                                          |
| `docs/ADMIN-OWNER-MULTI-ROLE.md:48`                                 | Historical owner setup report.                                            |
| `docs/ARCHITECTURE.md:125`                                          | Existing description of this checkout's issuer.                           |

This is a real checkout/local-schema discrepancy with the owner's stated Production ST format. No later issuer conversion exists in this checkout. Changing the local issuer would require separately authorized schema/backend work; blindly changing its two current database assertions would create false/failing tests. Historical applied migrations and existing identities were not edited. Production was not queried to investigate this discrepancy.

## 11. Validation and captures

Final results:

| Check                                                           | Result                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| `npm run typecheck`                                             | Pass                                                      |
| `npm run lint`                                                  | Pass                                                      |
| `npm run format:check`                                          | Pass                                                      |
| `git diff --check`                                              | Pass                                                      |
| `npm run build`                                                 | Pass                                                      |
| Admin/navigation/authorization domain and migration regressions | 108 passed, 0 failed, 0 skipped                           |
| P1/provider safety tests, no Production calls                   | 24 passed, 0 failed, 0 skipped                            |
| `npx tsx --test tests/admin-learning.test.ts`                   | 9 passed, 0 failed, 0 skipped                             |
| Selected L1 launch/profile test with updated synthetic IDs      | 1 passed, 0 failed                                        |
| Offline Admin Playwright                                        | 33 passed, 0 failed                                       |
| Focused final resource editor/scheduling rerun                  | 2 passed, 0 failed                                        |
| `npm run test:p1:runtime`                                       | 2 passed, 0 failed, 0 skipped                             |
| Existing source/history/client secret audit                     | No findings; no configured private values in built client |

Admin domain command: `NODE_OPTIONS=--conditions=react-server npx tsx --test tests/admin-navigation.test.ts tests/admin-dashboard-domain.test.ts tests/admin-a1-domain.test.ts tests/admin-a1-migration.test.ts tests/admin-a2-domain.test.ts tests/admin-a3-domain.test.ts tests/admin-a3-migration.test.ts tests/admin-a4-domain.test.ts tests/admin-roles-domain.test.ts tests/admin-roles-migration.test.ts`.

P1 safety command: `NODE_OPTIONS=--conditions=react-server npx tsx --test tests/production-p1.test.ts tests/production-providers.test.ts`. ID check: `NODE_OPTIONS=--conditions=react-server npx tsx --test --test-name-pattern='controlled launch and redirect' tests/l1-domain.test.ts`. UI command: `npx playwright test --config=playwright.admin-ui.config.ts`.

The offline harness renders real UI components with explicit synthetic GET responses and rejects external requests, server/provider imports and mutation requests. It exercises contextual URL filters, browser history, reused editors, exact four-area navigation, narrow roles, protected visibility, mobile focus behavior and unavailable recording controls. An initial harness run exposed a missing choices/items mock; it was corrected without changing application authentication or services. A required synthetic resource metadata type was corrected, and affected editor flows were rerun.

78 captures and 78 axe analyses, zero violations and zero document overflow: light widths 1440/1024/820/390/320, dark 1440/390, plus contextual Curriculum/Assignments/Batch Attendance/Batch Recordings at 1440/390. Captures use synthetic records only. Visually inspected desktop/mobile Learning, selected-Batch Classes and mobile Batch recording controls.

Ignored evidence directory: `docs/reviews/admin-ui/`. Manifest: `capture-manifest.json`; axe evidence: `axe-results.json`. Examples: `1440-learning-light.png`, `390-learning-light.png`, `1440-learning-classes-light.png`, `1440-learning-recordings-light.png`, `390-learning-batch-recordings-light.png`. Focused rerun: `docs/reviews/admin-learning-focused/`. Validation logs: `docs/reviews/admin-learning-validation/`. Secret audit: `docs/reviews/production-p1/secret-audit.json` (categories/counts only).

## 12. Safety and stop

No Production connection or mutation, schema/migration change, real business-data mutation, commit, push, publication or deployment. Database tests used the existing guarded disposable schemas in the loopback isolated Test database, separate from Development; fixtures were cleaned up. Existing uncommitted work was preserved. The local preview was rebuilt for review. No additional Admin or infrastructure phase began.
