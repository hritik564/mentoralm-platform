# Student LMS UI reset

This is a presentation reset of the completed L1–L4 student LMS. Database/schema/migrations, auth/entitlement/Enrollment, Student ID/Batch rules, scoring/completion/certificates, persistence, communications, API implementations, and the local seed utility are unchanged. The public website and Dashboard are unchanged. Nothing was deployed, pushed or committed.

## Approved references inspected

All eight new images in `Reference/` were opened visually, rather than identified by filename alone:

| Reference filename suffix | Actual surface        |
| ------------------------- | --------------------- |
| `11_22_32 AM-1.png`       | Home                  |
| `11_22_34 AM-2.png`       | Attendance            |
| `11_22_36 AM-3.png`       | Course/Lecture Player |
| `11_22_38 AM-4.png`       | Lectures              |
| `11_22_40 AM-5.png`       | Discussions           |
| `11_22_41 AM-6.png`       | Assignments           |
| `11_22_43 AM-7.png`       | Certificates          |
| `11_22_45 AM-8.png`       | Resources             |

The complete filenames start with `ChatGPT Image Oct 2, 2026, `. These are the approved MentoraLM direction; no Masai branding, assets or code were copied.

## Presentation changes

- Compact dark primary shell with official logo, Home/Learn/Chat/Support, active violet states and real account link. One consistent horizontally scrollable Learn subnav retains all six routes; unsupported notifications/calendar/global search/theme controls were not invented.
- Home uses independent responsive columns instead of tall full-width cards or blank grid reservations: real Continue Learning/progress/resume, pending Assignments, authoritative Attendance, historical sessions, actual Discussions, existing Batches and Support. Student ID/current Batch remain compact and LMS-only.
- Lectures are compact full-width learning rows, with client-side search, section and completion filters over the existing authorized outline. Resource rows link to the real library; future unsupported item types retain honest unavailable states. No instructor/session dates are fabricated for self-paced Lessons.
- Player puts main content on the left and compact real Course Outline on the right. Current/completed states, section grouping, required/optional/type labels, Previous/Next/Mark Complete, private media and progress are retained. Text presentation suppresses only an exact first-heading duplicate of the displayed title. Native video/PDF/image/external delivery remains intact. Mobile/tablet keep the existing native dialog with focus trap, Escape and focus return.
- Assignments and Resources remove outer nested panels, share search/filter styling, use dense rows and real actions/statuses. Assignment status/course filters and Resource section/type/title sorting operate on existing student projections; no backend filtering or new fields were added. Assignment detail retains instructions, upload, submission/resubmission/history/feedback and gains a compact metadata column.
- Attendance shows the existing percentage and actual present/late/absent/excused/unrecorded counts, a lightweight distribution, real session timestamps and searchable/status-filtered rows. No streak or calendar dates are invented.
- Discussions have a searchable course-scoped list, real reply counts/timestamps/lock states and the existing creation form. Detail retains safe member labels, plaintext posts, pagination and replies. No pinned records/tags/author profiles or thread previews are fabricated when the list projection lacks them.
- Certificates use premium record cards only for returned active eligible records, and separately labeled real course requirements/progress. A progress card is not an issued certificate. Existing private PDF actions appear only when a document is available. Suspended/revoked records remain subject to the locked server visibility rules.
- Quiz/Assessment use the same typography, controls, compact options and status language. One-question navigation/progress preserves all answer state and the existing save/submit/result/review/history mechanics. No scoring or interpretation logic changed.
- Shared icons, headers, section cards, search/filter controls, status badges and empty states are separate components. Reset styles are confined to the LMS and use restrained borders, navy surfaces and violet accents. No additional dependency or chart library was added.

## Visual comparison and intentional differences

Compared directly with the approved images for navigation prominence, control placement, hierarchy, 80px desktop learning rows, surface spacing and responsive grouping. The Home column layout was refined after the first captures to remove blank cells, and the mobile course context was widened to avoid narrow title wrapping. Desktop 1440 and mobile 390 use the twelve prescribed captures under ignored `docs/reviews/lms-ui-reset/`; tablet 820 is checked without another screenshot matrix.

Truthful differences: the development owner has one Course/Assignment/Resource and five historical sessions, so the lists contain fewer rows. Product updates, future schedule/live metadata, fake achievements, streaks, author/tag/preview metadata, Menti AI Tutor and unsupported header controls are omitted. The player uses actual lesson content and Course Outline, not a fabricated video cover or AI panel. The private Video fixture remains metadata-only/unavailable, and issued record-only Certificates never claim a PDF.

## Focused validation

Run against the already seeded existing Clerk Development owner and local production preview at port 3000:

```sh
npm run typecheck
npm run lint
npm run format:check
npm run build
LMS_UI_OWNER=user_YOUR_EXISTING_DEVELOPMENT_ID npx playwright test --config=playwright.lms-ui.config.ts
```

Email is also accepted for exact lookup. The UI test enforces the existing local database/development-key guard, creates a short-lived Clerk Development sign-in ticket for the existing account, and prints no credentials. It checks eight desktop pages and four mobile pages, representative WCAG AA axe/overflow checks, tablet Home/Player, real filters/empty states, assignment text/file controls, quiz navigation/save persistence, drawer focus trap/Escape/return, and authorized private PDF delivery. Only a newly created test-owned draft quiz attempt is removed; pre-existing student work is preserved. Its temporary ticket/session are revoked. Normal lesson access uses the existing application behavior.

Final execution results (local production preview):

| Check                      | Result                                                   |
| -------------------------- | -------------------------------------------------------- |
| Typecheck                  | Passed                                                   |
| Lint                       | Passed, zero warnings                                    |
| Format check               | Passed                                                   |
| Production build           | Passed                                                   |
| Focused browser smoke      | 1 passed (34.0s)                                         |
| Representative axe WCAG AA | Zero violations in scanned views                         |
| Responsive overflow        | Passed at 1440, 820 and 390                              |
| Visual captures            | Exactly eight desktop and four mobile, inspected         |
| Locked implementation diff | No changes in Prisma, domain services, APIs or Dashboard |

The final layout check detected and corrected a tablet subnav width regression. Captures now wait for completed page content rather than a transient loading state. One intermediate run redirected to Clerk sign-in during mobile navigation; a fresh-session rerun passed with page readiness assertions enabled. Browser verification uses the existing Clerk Development service and requires network access. The private Video fixture has no clip, and the owner has no issued Certificate, so those populated states are not asserted by this UI smoke test.

No historical domain suite is run: no backend/domain implementation was edited. Visual review is representative, not a claim of exhaustive assistive-technology certification.

## Files changed in this task

- LMS routes: `src/app/learn/layout.tsx`, `page.tsx`, `lectures/page.tsx`, `assignments/page.tsx`, `resources/page.tsx`, `certificates/page.tsx`.
- Existing components: `src/components/lms/LmsShell.tsx`, `LmsViews.tsx`, `AcademicHome.tsx`, `LearningLists.tsx`, `CoursePlayer.tsx`, `LessonDelivery.tsx`, `AssignmentList.tsx`, `AssignmentDetail.tsx`, `AttendanceView.tsx`, `Discussions.tsx`, `AttemptPlayer.tsx`.
- New primitives/lists: `src/components/lms/LmsPrimitives.tsx`, `LmsFilters.tsx`, `LectureList.tsx`, `CertificateList.tsx`.
- Scoped styles: `src/styles/lms-reset.css` (existing base stylesheet retained).
- Verification: `playwright.lms-ui.config.ts`, `tests/lms-ui-reset.spec.ts`, this report, and the twelve ignored review images.

The pre-existing owner-seed changes and newly supplied Reference images are retained; they are not modifications made by this presentation task.
