# Admin Console workflow simplification

Implemented for owner review on 17 November 2026, using the owner’s written navy/sidebar, light workspace, purple-accent direction as the approved reference. This is presentation/information architecture over the existing Admin system. No Production database/provider connection, data mutation, migration, provisioning, deployment, publish, push or commit was performed.

## Navigation and preserved routes

| Primary workspace | Entry           | Existing destinations retained                                                                                                                                                                      |
| ----------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview          | /admin          | Greeting, quick actions, real totals, scheduled UTC-day classes, attention queues, catalog and safe audit activity                                                                                  |
| Learning          | /admin/learning | /admin/courses, /admin/batches, /admin/attendance, /admin/assignments, /admin/submissions, /admin/assessments, /admin/attempts, /admin/question-banks, /admin/certificates and all existing details |
| Students          | /admin/students | Directory, detail, Enrollments, LMS override, Batch membership; /admin/referrals                                                                                                                    |
| People            | /admin/people   | /admin/instructors and /admin/users, including existing role/policy detail controls                                                                                                                 |
| Inbox             | /admin/inbox    | /admin/support, /admin/discussions, /admin/communications, details and message planning                                                                                                             |
| Settings          | /admin/settings | Existing read-only platform/security readiness and /admin/audit explorer                                                                                                                            |

The primary sidebar has exactly six items for an administrator with all capabilities. Scoped administrators see only relevant groups. Audit-only administrators enter Audit from Settings; referral-only administrators enter Referrals from Students. This preserves the exact existing child-page gates rather than broadening them. Old paths and opaque-reference links remain supported. Native admin-host paths and same-host /admin paths select the same active group. New workspace redirect destinations were added narrowly; external, malformed, traversal and arbitrary new child routes remain denied.

Desktop has a compact persistent navy rail, purple active state, line icons and retained Mentora. branding. Child destinations appear inside their workflow through landing cards/contextual navigation. Tablet/mobile use the existing native DashboardDialog as an accessible drawer: focus containment, Escape, focus restoration, body scroll lock, aria-expanded/controls/haspopup and close-on-navigation. Light/dark preferences remain. Tables scroll inside their own containers. No public/LMS/Dashboard visual redesign.

## Dashboard and data

The new Dashboard component consumes the existing authenticated Overview/operations endpoints. A read-only dashboard projection retains the original permission-filtered metrics and safeAuditAction activity labels, adding only existing-model counts and bounded safe records:

- Registered Students, effective LMS access and active Enrollments retain STUDENTS_MANAGE; unresolved Support remains SUPPORT_MANAGE.
- Active Batches, scheduled Live Classes, published recordings, ready-recording counts and today’s first five scheduled sessions require BATCHES_MANAGE. Cleanup-pending recordings are excluded. Session projections expose bounded titles/time/status/Batch labels and typed opaque references, never storage locations or external target IDs.
- Courses retain the existing published-count convention; the first five catalog rows with Program/publication/Enrollment aggregate require ACADEMICS_MANAGE, matching existing catalog authority.
- Today is explicitly **UTC**, including half-open midnight bounds, to avoid inventing a business timezone. The greeting uses the administrator’s local device hour and actual account name. No business state changes at midnight or from viewing this page.
- Assignment/text review, missing attendance, certificate hold and communication-plan counts reuse the existing operational projections. Pending Enrollment counts were not invented. All attention links lead to existing authorized areas.
- Audit activity remains AUDIT_VIEW-only and uses existing safe human-readable labels. Raw audit payloads/history are unchanged.

No fake runtime counts, classes, Students or course records are introduced. Mock records exist only in test fixtures and are never imported by app routes. Existing Student IDs render unchanged from the application data; new UI fixtures use ST-YYYY-######, with no old prefix introduced into production UI.

## Actions and availability

Create Course and Create Batch open the existing editors through narrowly interpreted query intents. Closing consumes the intent; same-path navigation, cancel/reopen and Programs/Courses remounts are tested. Existing creation services, validation and audit writes are unchanged.

Schedule Class works through the existing Batch Live Sessions / SessionEditor workflow. The new Live Classes page selects a real Batch and deep-links its Live Sessions tab; all existing tabs and browser Back/Forward remain functional. No new scheduling backend, calendar or Webinar.gg integration.

Publish Recording is visibly marked **not configured** and leads to the recordings workspace with an honest provider explanation and existing per-Batch recording management links. Upload/processing/publication availability remains exactly as before; metadata and unpublish controls are retained. No fake recording, asset, upload or attendance logic. Existing communication plans retain their provider-pending behavior.

## New structure

New routes: /admin/learning, /admin/learning/classes, /admin/learning/recordings, /admin/people and /admin/inbox. Each new page retains server-side persisted Admin checks; union capabilities control hub entry, and class/recording entry specifically requires BATCHES_MANAGE. Every underlying service keeps its exact domain permission checks.

New shared UI: Dashboard, Workspaces, AdminIcon, WorkspacePage and useCreateDialog. Pure navigation registry groups destinations without becoming authorization authority. Existing AdminShell, directory, catalog, dialogs and Batch detail are reused. DashboardDialog gains only an optional DOM id; its existing behavior for other surfaces is unchanged. The old duplicate Overview presentation is replaced; the existing operations component remains available elsewhere in source.

Read-only backend scope is src/lib/admin/dashboard.ts called by the existing AdminRepository.overview(). No write-service, auth policy, role semantics, governance service, LMS entitlement/access logic, schema or migration changed. No package/dependency/lockfile or environment changes.

## Validation

| Executed check                                                                     | Result                                                                                                                                         |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin/navigation/dashboard/A1/A2/A3/A4/multi-role domain and migration regressions | 108 passed, zero failures/skips                                                                                                                |
| Production foundation/provider safety contracts                                    | 24 passed, zero failures/skips                                                                                                                 |
| Current optimized runtime safety                                                   | 2 passed, zero failures/skips; every new workspace and existing sensitive route redirects anonymous users, ignores forged forwarding authority |
| Provider-free Admin Playwright                                                     | 20 passed, zero failures/skips                                                                                                                 |
| Responsive screenshot/axe captures                                                 | 49 captures/checks, zero WCAG 2 A/AA and 2.1 A/AA violations; no document overflow                                                             |
| TypeScript, lint, Prettier, optimized build, git diff --check                      | Passed                                                                                                                                         |
| Known-format source/history/private-client-value scan                              | Passed; no real credential findings or private credential values in generated client JS                                                        |

154 automated tests total. Database tests use the existing safety helper: explicit opt-in, verified loopback isolated mentoralm_test, random disposable schemas; migrations/fixtures/cleanup stay there. No real Development business data was modified. Governance tests cover policy/role denial, fresh revocation, grant/regrant, stale state, self/final-Governor protection, concurrency, rollback, immutable audit and scoped access. New projection tests assert query omissions, opaque projections, cleanup and UTC boundaries, bounded results and permission revocation.

The new browser config is separate from the app/marketing harness. It bundles the real components with test-only Clerk/router aliases, intercepts every expected local GET, rejects non-GET/unexpected/external requests, and forbids provider/server modules. Captures show clearly synthetic test data. These checks verify UI/accessibility, not live Clerk Production cookies or real provider delivery. Existing A1/A4/owner browser expectations were updated for grouped navigation/greeting; their external Clerk Development workflows were not rerun in this provider-free review. Server authorization is covered by the actual isolated PostgreSQL domain suite and anonymous optimized-server checks.

Browser captures cover all six workflow pages at 1440, 1024, 820, 390 and 320 pixels in light mode, plus 1440/390 dark; additional captures cover the real Batch Live Sessions view, mobile drawer, empty/error/scoped/no-permission states. Loading is exercised separately without inventing results. Full-page captures and axe summaries are ignored under docs/reviews/admin-ui/; safe logs are under docs/reviews/admin-ui/logs/.

## Owner review

Start the local application and inspect /admin, /admin/learning, /admin/students, /admin/people, /admin/inbox and /admin/settings. Also inspect /admin/learning/classes, /admin/learning/recordings, /admin/audit and an existing Batch’s ?tab=sessions. Try both creation actions, cancel, and browser Back/Forward; inspect dark mode and the mobile drawer. The review server remains local-only. No Production mutation or deployment occurred. No commit/push was requested or performed.

The default timezone remains explicitly UTC until a platform timezone is separately approved. Recording publication and provider sends remain infrastructure-dependent. No unresolved local validation failure is known; real authenticated owner review and live provider verification remain separate from the offline UI captures.
