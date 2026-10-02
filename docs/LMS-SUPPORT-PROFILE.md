# Native LMS Support and Profile

Support and Profile now remain inside the LMS. No duplicate identity/profile/ticket store, Prisma change, migration, public redesign, Dashboard redesign, LMS Auth UX or Admin work was introduced. Nothing was deployed or pushed.

## Routes and navigation

| Surface              | Local/internal route  | Approved LMS host route |
| -------------------- | --------------------- | ----------------------- |
| Support list         | `/learn/support`      | `/support`              |
| Support conversation | `/learn/support/[id]` | `/support/[id]`         |
| Profile              | `/learn/profile`      | `/profile`              |

The existing approved-domain routing and login-return allowlists now accept these destinations and reject unsupported paths/query redirects. On `students.mentoralm.com`, they rewrite to the same application routes under the LMS layout. No new DNS/domain/authentication setup is introduced.

Top navigation Support, Home's Support card, the LMS boundary's Support link and Discussion's missing-item Support link all use native LMS destinations. Avatar opens the existing accessible account disclosure, configured with Profile, Support and Log out. Escape/focus return, arrow navigation, outside-click dismissal and Tab dismissal are retained. Logout invokes the same Clerk signOut operation and returns to the protected LMS root, which resolves to the existing sign-in flow. The intentionally separate Student Dashboard footer link is retained. Support/Profile do not display Learn tabs or mark Learn active.

## Shared services and data

Support uses `getTickets`, `getTicket` and `ticketView` from the existing student services and existing SupportTicket/SupportMessage records. It presents real subject/category/status/reference/update dates, a chronological conversation from the existing bounded history projection, Create ticket and student Reply for open/in-progress tickets. Closed/resolved tickets display read-only history. No agent presence, response-time claims, AI or invented categories/statuses.

Profile uses the existing `requireStudentProfile` User/Clerk/StudentProfile projection. Personal name/email/phone are shown and managed through the existing secure Clerk account modal. The same existing education-level/institution/year/interests/career-goals fields are editable using the original strict validation and StudentProfile upsert. Student ID/current Batch come from `getLmsIdentity`; available courses come from the already authorized LMS repository. No entitlement controls, internal User/Clerk IDs or administrator fields are displayed. The Student ID/Batch fields remain LMS-only.

## Thin API integration and security

The new `/api/lms/account/[...path]` adapter accepts only the existing Profile and ticket operations. Every request first invokes `getLmsRepository()` for verified identity/role/business entitlement, then delegates to the unchanged `/api/student/[...path]` handler. Its existing request method dispatch, JSON size/content-type/origin boundary, private no-store responses, StudentRepository validation, owner-scoped ticket/profile queries, serializable reply/status transaction and mutation-limiter policies remain authoritative. Student-provided owner/role/STAFF/entitlement fields are rejected. Missing/foreign tickets render a generic native unavailable page and return the existing private API denial.

All new pages inherit the protected LMS layout and also perform their own entitlement check before fetching shared account data. Entitlement restrictions remain intact, including for Support/Profile. Existing Dashboard services and API policies remain unchanged. There is no new rate limiter/audit implementation; the original per-process limiter and its existing multi-instance deployment limitation remain.

## Presentation and accessibility

The new surfaces inherit all approved LMS theme variables and compact typography. Profile uses two columns on desktop and one on mobile; Support conversation/metadata adapt at tablet sizes. Forms are labelled, validation feedback is textual and focused, and status badges preserve actual text. Create/Edit dialogs reuse the existing modal focus trap, Escape and focus return through an optional className, whose Dashboard default remains unchanged. The Clerk account modal mounts inside the LMS shell with the current theme palette. No global/public/Dashboard CSS was altered by this integration.

## Focused validation

```sh
npm run typecheck
npm run lint
npm run format:check
npm run build
NODE_OPTIONS=--conditions=react-server npx tsx --test tests/lms-account-domain.test.ts
LMS_UI_OWNER=user_YOUR_EXISTING_DEVELOPMENT_ID npx playwright test --config=playwright.lms-account.config.ts
```

The existing owner's exact Development email is accepted too. PostgreSQL checks use the existing isolated-database guard against `TEST_DATABASE_URL`, requiring loopback, a dedicated `_test` database distinct from development and explicit opt-in. They prepare/drop a disposable schema using existing migrations; there is no application schema/migration change.

The browser test requires the existing local-development owner guard. It uses a temporary normal Clerk sign-in ticket/session, creates its own temporary owner ticket and a database-only foreign-owner fixture, checks Profile editing through the real UI and verifies shared Dashboard visibility. It restores the original profile and removes test-created records, revoking its temporary ticket/session; no new Clerk user is created or email sent. Existing owner tickets/submissions/learning data are preserved.

| Check                            | Result                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------- |
| Typecheck                        | Passed                                                                        |
| Lint                             | Passed, zero warnings                                                         |
| Format check                     | Passed                                                                        |
| Production build                 | Passed                                                                        |
| Focused PostgreSQL/routing tests | 2 passed, 0 skipped                                                           |
| Focused browser test             | 1 passed (25.0s)                                                              |
| Representative WCAG AA axe       | Zero violations in scanned views/forms/menu                                   |
| Responsive overflow              | Passed at 1440, 820 and 390                                                   |
| Visual review                    | Desktop Support/Profile in both themes; mobile Profile/conversation inspected |
| Shared-domain/schema diff        | Student/LMS services, original student API and Prisma unchanged               |

Coverage includes real create/reply/read-only closed tickets, generic foreign-ticket UI/API denial, foreign replies, owner/STAFF spoof rejection, cross-origin mutation rejection, private Profile source, Student ID/Batch display, provider account modal, account menu Escape/focus, native routing and real logout/unauthenticated denial. Dashboard Support and Profile show the same ticket/profile mutations without a UI redesign. One intermediate browser run hit an existing Clerk backend fetch failure; the fresh-session run passed. Browser verification requires the Clerk Development service/network. Live production DNS and cross-subdomain authentication are not asserted by local host-routing checks. Historical LMS suites were not rerun because no learning/business services changed.

## Files changed in this integration

- Routes: `src/app/learn/support/page.tsx`, `src/app/learn/support/[id]/page.tsx`, `src/app/learn/support/[id]/not-found.tsx`, `src/app/learn/profile/page.tsx` (new).
- Thin adapter: `src/app/api/lms/account/[...path]/route.ts` (new).
- Native UI: `src/components/lms/LmsSupport.tsx`, `LmsProfile.tsx`, `account-client.ts`, `src/styles/lms-account.css` (new).
- LMS integration: `src/components/lms/LmsShell.tsx`, `LmsBoundary.tsx`, `src/app/learn/layout.tsx`, `page.tsx`, `discussions/not-found.tsx`.
- Reused UI options: `src/components/auth/AccountMenu.tsx`, `src/components/dashboard/DashboardDialog.tsx` (existing defaults retained).
- Route allowlists: `src/lib/platform/domains.ts`, `src/lib/auth/redirects.ts`.
- Verification/report: `tests/lms-account.spec.ts`, `tests/lms-account-domain.test.ts`, `playwright.lms-account.config.ts`, this document (new); captures are ignored under `docs/reviews/lms-account/`.

Earlier approved redesign/theme and owner-seed edits remain in the worktree; this list identifies only this integration's changes.
