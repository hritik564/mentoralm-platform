# A1 preflight: recording schema decision

Status: historical preflight. Superseded by the owner-approved final schema and implementation in ADMIN-A1-RECORDING-VERIFICATION.md and ADMIN-A1.md. Migration 20261002180000_admin_a1_recordings is applied locally.

The request explicitly requires stopping before a necessary schema change. A1 cannot currently persist a Live Session recording or its processing/publication lifecycle safely.

## Reference inspected

The specified `Reference/Admin-A1-Overview-Students-Batch.png` is not present. The newly supplied `Reference/ChatGPT Image Oct 2, 2026, 04_22_06 PM.png` was inspected visually and contains the four requested Admin compositions: Overview, Students, Student Detail, and Batch Detail / Live Sessions. Its operational density, navy sidebar, restrained purple accents, compact tables and detail tabs are suitable visual guidance; its fictional records and metrics will not be copied.

## Existing models and services to reuse

- Persisted `User.role` already includes ADMIN; no permission bypass or additional identity store is needed.
- `User.lmsAccessOverride`, `Batch.lmsAccessEnabled` and active `BatchMembership` remain the authoritative entitlement sources.
- `LmsAccessAdmin` already role-checks and transactionally audits override, Batch access and Enrollment mutations.
- `Enrollment` has its existing status semantics; completion belongs to the LMS completion service. Batch membership remains independent.
- `Batch`, `BatchMembership`, `BatchInstructor`, `BatchSession` and LIVE_SESSION LearningItems already represent the corresponding operational entities.
- `AcademicAudit` already supports actor, action, target, timestamp and JSON details for before/after metadata. It can be reused without a new audit table.
- Names/contact fields belong to the existing Clerk identity, while education/career fields belong to `StudentProfile`. No duplicate profile model is proposed.

## What is missing and why existing models cannot represent it

`BatchSession` contains scheduling, status, optional Course/LearningItem context and an approved external meeting-target reference. It has no recording relation, private storage reference, processing state or publication timestamp.

A `Lesson` has media metadata, but its relation is constrained to a LESSON LearningItem, not a LIVE_SESSION item. Recasting a session as a Lesson would violate the established learning subtype and duplicate learning content. `Resource` has private storage metadata but no Live Session relationship or processing lifecycle. Neither `AcademicAudit.details` nor `LearningEvent` should become the mutable source of truth for a recording.

The existing private-media implementation securely reads authorized files, including ranged video delivery. It is not a large-video upload/processing provider and has no storage-confirmed readiness workflow. A new persistence model alone will not provide that infrastructure.

## Proposed minimal additive schema

Add one optional one-to-one `BatchSessionRecording` model keyed by the existing `BatchSession.id`:

| Field                     | Purpose                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| sessionId                 | Primary key and foreign key to the existing BatchSession; restrict deletion |
| title, description        | Optional recording-specific text; otherwise use the session title           |
| storageKey                | Nullable, opaque private provider reference; never a permanent public URL   |
| fileName, mimeType, bytes | Nullable object metadata confirmed by storage; bytes uses BigInt            |
| durationSeconds           | Optional verified duration                                                  |
| status                    | New enum: UPLOADING, PROCESSING, READY, PUBLISHED, FAILED                   |
| publishedAt               | Nullable publication timestamp                                              |
| createdAt, updatedAt      | Lifecycle timestamps                                                        |

Add the optional inverse relation on `BatchSession`. Absence of a recording row means NO_RECORDING; no placeholder rows or backfill are needed. Thumbnail metadata can remain unsupported until a provider supplies it.

Use database checks for positive file size, nonnegative duration and publication consistency. READY/PUBLISHED require a private object reference and verified media metadata. Services must confirm readiness through the storage adapter; clients cannot assert READY or supply arbitrary delivery URLs. Publication and audit must commit atomically. Student delivery must retain LMS entitlement, Enrollment and applicable Course/Batch authorization. Recording operations never alter attendance.

No changes to User, roles, Enrollment, Batch membership or existing learning subtype constraints are proposed.

## Migration impact and infrastructure

The migration adds one enum, one table, its foreign key and integrity checks. Existing records remain unchanged and are projected as NO_RECORDING. No reset, destructive rewrite, role promotion, DNS modification or production database connection is needed. Once approved, apply/validate only against the configured local development and isolated test databases.

A1 can implement a provider-independent upload/processing contract and honest unavailable UI while the production provider is unconfigured. It must not accept large video binaries through the current small-file submission uploader, write them into PostgreSQL, fake processing completion or expose permanent raw URLs. Actual large-video upload, processing and controlled delivery require a private production storage/streaming adapter; no vendor is selected by this proposal.

## Decision required

Approve the minimal recording schema above, or explicitly revise A1 to defer recording persistence/publication and deliver an unavailable recording integration foundation only. Until that decision, A1 implementation is paused under the user's schema stop requirement.
