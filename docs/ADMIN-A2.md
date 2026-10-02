# Admin A2 — Academic management and course authoring

Completed locally on 3 October 2026. A2 writes to the same academic models consumed by Student LMS. A1 operational design, recording rules, identity and student authorization remain intact. No A3, production connection, deployment or push.

## Delivered scope

| Requested area                | Implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Programs                   | Paginated/searchable Program list, create/edit title, inspect associated Courses. Existing Program has title metadata only; no invented Program publication state or marketing CMS.                                                                                                                                                                                                                                                                                        |
| 2. Courses                    | Paginated title search, Program and Draft/Published filters, enrollment counts, draft creation and supported metadata/policy editing. Searchable Program selection uses bounded choices. Course edits do not create/change Enrollments. Completion/certificate/attendance policy is locked after Enrollment; Program rebinding is blocked when session context exists.                                                                                                     |
| 3. Course Builder             | One Course → Section → LearningItem workspace using existing LESSON, QUIZ, ASSIGNMENT, RESOURCE, LIVE_SESSION and ASSESSMENT. Typed badges, required/optional, publication and subtype/configuration indicators; direct item editor links from activity lists.                                                                                                                                                                                                             |
| 4. Sections / ordering        | Create, rename/describe, publish/unpublish, move Sections and items up/down. Serializable transactions swap through an unused positive position, respecting existing unique indexes and positive checks. Empty draft Section deletion only; item removal rejects history, session references, attached media and Course certificates.                                                                                                                                      |
| 5. Lesson authoring           | Existing structured TEXT heading/paragraph/list/callout/code/divider blocks with order controls; VIDEO, PDF, IMAGE and approved EXTERNAL targets. No arbitrary HTML/iframe/URL input. Escaped code examples remain supported. Image alternative text and file presence/signature are required to publish.                                                                                                                                                                  |
| 6. Resources                  | LMS LearningResource attached to RESOURCE items, private supported files, description and authorized-download metadata. Dashboard Resource is untouched and not exposed by these routes.                                                                                                                                                                                                                                                                                   |
| 7. Live Sessions              | Select/create LIVE_SESSION items and add multiple BatchSession occurrences with canonical Course/item context, Batch, time, assigned Instructor and approved meeting target. Associated occurrences show real recording status and link to A1 Batch management. Existing occurrences can be bound through A1's session editor; history fences remain enforced. No attendance mutation from watching recordings.                                                            |
| 8. Question Banks / questions | Paginated/searchable banks and questions, create/edit title, reusable questions and type-aware correct answers. SINGLE_CHOICE exactly one correct; MULTIPLE_CHOICE one or more correct; TRUE_FALSE exactly one Boolean answer; SHORT_TEXT/LONG_TEXT no fake answer key or semantic grading. Question type is fixed after creation.                                                                                                                                         |
| 9. Quizzes                    | Existing AcademicActivity configuration: instructions, selected ordered questions/points, passing percentage, attempt limit, answer review and publication. Attempt scoring/resume/submission code is unchanged; objective snapshots and exact multiple-choice scoring remain authoritative.                                                                                                                                                                               |
| 10. Assessments               | Separate ASSESSMENT kind using existing activity/attempt engine. Text responses remain review-required. No interpretation, recommendations, AI grading or Quantum Engine.                                                                                                                                                                                                                                                                                                  |
| 11. Assignments               | Instructions, due date, existing response kinds, upload limits, acceptance/resubmission settings and item required/publication controls. Submission versions/files/reviews are retained. Acceptance policy cannot change after submissions.                                                                                                                                                                                                                                |
| 12. Publishing                | Configure/publish items, then Sections, then Course. Course and Section validation checks published descendants; unpublished parents hide descendants. Activity/Assignment publication synchronizes atomically with item publication. Incomplete/invalid content cannot be published. Questions used by published activities cannot be unpublished independently.                                                                                                          |
| 13. Audit / security          | Clerk → existing User → effective persisted ADMIN, checked before APIs/read repositories and inside write transactions. Exact parent context, typed opaque handles, same-origin writes, strict Zod inputs, server actor, 16 KiB JSON limit and existing rate limits. Concise AcademicAudit records cover catalog, ordering, content, answers, activity/assignment configuration/publication and A1 Live Session binding. No large bodies or video bytes in audit/database. |
| 14. Schema                    | **No A2 schema change or migration.** Reuses existing L1–L3 academic tables and A1 BatchSession/recording/roles. Prisma valid, local development schema diff reports “No difference detected”; all nine existing migrations remain applied.                                                                                                                                                                                                                                |

Editing current content/configuration affects future consumption and derived progress, not immutable past attempts or submitted versions. There is no new revision/history system for lesson bodies. Unpublishing retains rows and history; referenced items are not cascade-deleted. Existing Course completion/certificate reconciliation semantics remain unchanged.

## Private media and infrastructure

Attachments reuse `LMS_FILES_ROOT` and existing authorized LMS media delivery. Generated opaque storage keys are server-only, files use exclusive no-follow creation and private filesystem permissions, and MIME/signature/size/UTF-8 checks apply. JSON DTOs expose attachment metadata, not storage keys or permanent/signed playback URLs. PDF/image/text attachments are limited to 25 MiB; lesson video to 50 MiB. Video bytes are never stored in PostgreSQL. Recording upload/provider processing remains unavailable until actual private provider infrastructure exists; A2 does not fake it.

Replacement requires an unpublished item. Durable audit intent precedes file creation, transaction binding records the prior key, and cleanup only deletes unreferenced server-owned A2 assets. Legacy/shared keys, caption references and current assets are preserved. Failed/interrupted cleanup remains discoverable by audit reconciliation. Do not manually clear audit history while pending assets exist.

Guarded local repair command, using an existing effective Admin:

```sh
npm run dev:academic-media-reconcile -- arcaderobo3@gmail.com
```

Stop active authoring before running repair. The command validates Development Clerk keys, loopback `mentoralm_dev/public` identity and persisted ADMIN; no production fallback. It scans at most 1,000 recent eligible audit intents older than an hour, skips confirmed cleanup and retained database references, and reports examined/cleaned counts. This is bounded operator repair, not a background storage provider or full retention system. Production needs durable private storage/scanning, large-video infrastructure and shared atomic rate limiting before multi-instance use.

V1 limits: 20-row catalog/activity/question pages; 50 Program choices per search; 50 applicable Batches and latest 50 occurrences; builder maximum 50 Sections, 100 items per Section, 500 total. JSON authoring keeps the existing 16 KiB limit and reports oversized requests before sending; split larger content into smaller learning items. Thumbnail selection uses approved existing images; Course public handoff remains `/#programs`. No marketing CMS or arbitrary public path editor.

## 15. Files changed in A2

New services:

- `src/lib/admin/academic/core.ts`
- `src/lib/admin/academic/validation.ts`
- `src/lib/admin/academic/catalog.ts`
- `src/lib/admin/academic/structure.ts`
- `src/lib/admin/academic/publication.ts`
- `src/lib/admin/academic/authoring.ts`
- `src/lib/admin/academic/media.ts`
- `src/app/api/admin/academic/[...path]/route.ts`

New pages/components:

- `src/app/admin/courses/page.tsx`
- `src/app/admin/courses/[ref]/page.tsx`
- `src/app/admin/assessments/page.tsx`
- `src/app/admin/assignments/page.tsx`
- `src/app/admin/question-banks/[ref]/page.tsx`
- `src/components/admin/academic/types.ts`
- `src/components/admin/academic/forms.tsx`
- `src/components/admin/academic/Catalog.tsx`
- `src/components/admin/academic/Builder.tsx`
- `src/components/admin/academic/ItemEditor.tsx`
- `src/components/admin/academic/LessonEditor.tsx`
- `src/components/admin/academic/ActivityEditor.tsx`
- `src/components/admin/academic/LiveEditor.tsx`
- `src/components/admin/academic/Questions.tsx`
- `src/styles/admin-academic.css`

Integration and validation:

- `src/app/admin/layout.tsx` — scoped A2 stylesheet.
- `src/components/admin/AdminShell.tsx` — enable approved destinations and related active navigation.
- `src/components/admin/client.ts` — clear oversized JSON form feedback.
- `src/lib/admin/handles.ts` — typed Section/Bank/Question handles.
- `src/lib/platform/domains.ts` — narrow academic Admin return routes.
- `scripts/admin-owner/reconcile-media.ts`
- `tests/admin-a2-domain.test.ts`
- `tests/admin-a2.spec.ts`
- `playwright.admin-a2.config.ts`
- `tests/admin-roles-domain.test.ts` — explicit equal fixture timestamps prevent a PostgreSQL clock-order race; production constraints unchanged.
- `package.json` — A2 test and guarded media repair commands, no new dependency.
- `docs/ADMIN-A2.md`, `docs/ADMIN-A1.md`, `docs/DECISIONS.md`.

Existing uncommitted work from prior phases is preserved; this list describes A2 contributions, not the entire workspace Git diff.

## 16. Checks and results

| Check                                                                        | Result                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prisma validate                                                              | Passed.                                                                                                                                                                                                                                          |
| Guarded development migration/schema verification                            | `mentoralm_dev/public`, nine applied migrations, no schema difference; no migration executed for A2.                                                                                                                                             |
| Typecheck / lint / format check / production build                           | Passed.                                                                                                                                                                                                                                          |
| Focused A2 domain suite                                                      | 20 tests passed, no failures/skips, actual isolated PostgreSQL Test schemas and temporary private files.                                                                                                                                         |
| Combined A2 + A1 + multi-role + L1/L2/L3/L4 + auth/account domain regression | 89 passed, 0 failed, 0 skipped.                                                                                                                                                                                                                  |
| A2 Admin browser suite                                                       | 2 passed using the existing owner Development identity. Catalog/builder/editors, publication, strict/origin/body/handle security, keyboard/focus and 1440/1024/820/390 layouts.                                                                  |
| A1 Admin browser regression                                                  | 2 passed: original Admin workflows, effective-role denial, private recording foundations, responsive themes and trusted host boundaries.                                                                                                         |
| Representative axe checks                                                    | Zero violations on desktop light/dark builder, Quiz/Assignment/Live Session editors, banks/question editors, catalog, light Lesson editor and 820 builder/Lesson editor.                                                                         |
| Owner preservation                                                           | Primary STUDENT + additional ADMIN retained. Student data digest identical before/after `fa79fe67608e51e71bb844c3d340cd302ad5bc9043e2fa6f894efdbab4f94b94`. One membership/Enrollment, five attendance records and three LessonStates unchanged. |
| Visual review                                                                | Inspected desktop light builder, dark question editor, light Live Session view, 820 Lesson editor and 390 builder. No uncontrolled document/dialog overflow in browser checks.                                                                   |

Domain tests cover fresh non-Admin/revoked Admin denial, incorrect parents, ordering concurrency, draft visibility, all lesson formats/private signatures, unsafe HTML/external targets, question answer rules, snapshot scoring, immutable submissions, multiple Batch occurrences, protected history/deletion, concise audit and repeatable orphan cleanup. The database harness verifies isolated `mentoralm_test` identity and rejects development/production targets before applying test-schema migrations. Browser fixtures use guarded local Development and are removed by exact randomized IDs; no owner Enrollment or permanent fake academic business data is created.

## 17. Captures

Ignored directory: `docs/reviews/admin-a2/` (21 screenshots plus two owner/cleanup verification proofs).

- `1440-programs-courses-light.png`, `1440-programs-courses-dark.png`
- `1440-course-builder-light.png`, `1440-course-builder-dark.png`
- `1440-lesson-editor-light.png`
- `1440-question-bank-light.png`, `1440-question-bank-dark.png`
- `1440-question-editor-light.png`, `1440-question-editor-dark.png`
- `1440-quiz-editor-light.png`, `1440-quiz-editor-dark.png`
- `1440-assignment-editor-light.png`, `1440-assignment-editor-dark.png`
- `1440-live-session-academic-light.png`, `1440-live-session-academic-dark.png`
- `1024-course-builder-dark.png`, `1024-lesson-editor-dark.png`
- `820-course-builder-dark.png`, `820-lesson-editor-dark.png`
- `390-course-builder-dark.png`, `390-lesson-editor-dark.png`
- `owner-student-preservation.json`
- `final-local-verification.json` — Student/ADMIN coexistence and zero temporary A2 Programs/Courses/Banks/Batches after cleanup.

Captures contain temporary randomized review fixtures. They demonstrate real local database-backed authoring; those fixtures are removed after the test.

## 18. Deferred A3 / owner handoff

A2 is complete. Open local `/admin/courses`, `/admin/assessments` or `/admin/assignments` with the existing owner account. Native production Admin domain mappings are prepared in existing configuration; no domains/DNS are deployed.

A3 remains unstarted: expanded attendance, grading/review operations, certificate management, discussion moderation, Support administration, communications sending, referrals, Users/Roles UI, granular permissions, audit explorer, Settings, Zoom, AI tutor, payments, analytics and mobile LMS. Existing A1 surfaces remain operational and future sidebar destinations disabled. No commit, push or deployment was performed.

Recommended owner-reviewed commit: `feat(admin): add academic course and assessment management`.
