# Future platform responsibilities

Everything in this document is deferred context, not current implementation scope. Dashboard, LMS, and Admin must not be built during the website phase unless explicitly requested.

## Student Dashboard / Portal

Future responsibilities include student profile, applications, enrollment overview, My Courses, resources, reports, certificates, support, account/settings, and entry into LMS.

Dashboard presents a student's operational and learning overview. Learning progress remains owned by the learning domain; displaying it does not make Dashboard authoritative. Exact ownership of other operational records requires later domain design.

## LMS / learning domain

The conceptual hierarchy is **Program → Course → Section → Lesson**. Program and Course are different concepts; their cardinalities and reuse rules remain open.

Future learning functionality includes:

- Lesson content: videos, articles, PDFs, audio, external resources, and interactive content
- Progress tracking and course completion
- Assessments, quizzes, exams, question banks, and assessment attempts/answers
- Assignments, submissions, and grading
- Certificate eligibility

Enrollment controls learning access. Define lifecycle, access timing, completion criteria, scoring, and certificate policy before implementing those rules. Preserve historical integrity of assessment attempts and answers. Published learning content must eventually support safe versioning without corrupting learner history.

## Admin Console

Future operational areas include Students, Applications, Enrollments, Programs, Courses, Sections, Lessons, Assessments, Question Banks, Assignments, Certificates, Resources, Media, Support, Notifications, Analytics, Roles & Permissions, Audit Logs, and System Settings.

Admin is a control plane. Backend permissions must protect actions; sensitive mutations produce audit events. Evolve toward granular permissions rather than assuming one universal admin role. Admin operations use domain-owned rules and must not bypass enrollment, learning, or integrity constraints.

## Shared foundation

All surfaces must remain compatible with unified identity and shared backend, database, storage, authorization, and domain models. Shared identity does not imply identical permissions. See [Architecture](ARCHITECTURE.md) and [Security](SECURITY.md).
