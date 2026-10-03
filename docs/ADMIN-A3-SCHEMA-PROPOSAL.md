# Admin A3 schema checkpoint — approved and implemented

Owner approved both additions on 3 October 2026, with explicit state invariants. This document records the resulting schema, superseding the original immutable-review and reject-ineligible-restore proposals. Migration `20261003000000_admin_a3_operations` was applied only to guarded local Development and validated in isolated Test schemas. See `ADMIN-A3.md` for implementation and executed checks.

## 1. Manual text-response review without modifying submitted answers

### Exact missing capability and evidence

`AcademicResponse` contains `awardedPoints` and `requiresReview`, but PostgreSQL's `academic_response_immutable` trigger rejects **every** update once its parent Attempt is SUBMITTED, including these grading fields. See `prisma/migrations/20261001100000_academic_engine/migration.sql:402`–409. `ResponseOption` has a separate immutable guard. There is no persisted human-review child model/service.

Updating those fields directly would fail. Relaxing the existing snapshot trigger would change a locked integrity boundary. Storing grades only in `AcademicAudit.details` would turn the audit journal into authoritative academic state and require replaying audit history for student results. Neither is recommended.

### Smallest additive proposal

Add one effective current review per submitted text response as a child of the **existing** AcademicResponse. Keep both current snapshot triggers unchanged. No second attempt, scoring engine, User or question system.

```prisma
// Add to the existing User model:
academicResponseReviews AcademicResponseReview[]

// Add to the existing AcademicResponse model:
review AcademicResponseReview?

model AcademicResponseReview {
  responseId    String           @id
  response      AcademicResponse @relation(fields: [responseId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  reviewerId    String
  reviewer      User             @relation(fields: [reviewerId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  awardedPoints Int
  feedback      String?          @db.VarChar(2000)
  reviewedAt    DateTime         @default(now()) @db.Timestamptz(6)

  @@index([reviewerId, reviewedAt(sort: Desc)])
}
```

`responseId` is PK/FK: one effective current review for one existing response. `reviewerId` identifies the real server-authorized Admin User; existing additional ADMIN assignments work without replacing its Student persona. The index supports reviewer/history reads. Optional feedback is bounded plain text, not a student-answer copy; audit records only outcome/point indicators, not feedback bodies.

Migration SQL adds:

- `awardedPoints >= 0` CHECK.
- Optional feedback either NULL or nonblank, with the 2,000-character database limit.
- INSERT/UPDATE validation trigger: parent Attempt must be SUBMITTED, response must be SHORT_TEXT/LONG_TEXT with its original `requiresReview = true`, and awarded points cannot exceed the immutable response's snapshotted `points`.
- Corrections update the single effective child outcome, require server Admin authorization, and record concise before/after in AcademicAudit. The response relation cannot change. DELETE is rejected to preserve reviewed academic history; submitted response and option guards remain untouched.

The existing response/option immutability triggers are retained verbatim. Submitted student text, prompt, options, answer keys, point ceiling and original submission facts remain unchanged.

### Implemented service/projection behavior

Clerk → MentoraLM User → effective persisted ADMIN is rechecked inside the serializable review transaction. Exact Course → item → Attempt → response context is server-validated; no client reviewer, actor or max-points claim is accepted.

The review upserts this record, recomputes existing Attempt aggregate score/maxScore/percentage/requiresReview/passed using snapshotted objective scores plus effective human points, audits the action, and calls the existing completion policy service. Remaining unreviewed text keeps the Attempt pending; snapshot passing/review policy and objective scoring do not change.

Student result projections merge review outcome into the current DTO and keep its current answer-key/feedback visibility policy. The original response `requiresReview` remains the snapshot flag; effective pending state is determined by the presence of this review. No AI grading or new academic interpretation.

## 2. Persistent Admin certificate suspension

### Exact missing capability and evidence

The existing Certificate status is ACTIVE / SUSPENDED / REVOKED. `evaluateCompletion` automatically changes a SUSPENDED certificate to ACTIVE whenever current eligibility passes (`src/lib/lms/completion.ts:94`–98).

This is appropriate for automatic eligibility suspension. It cannot distinguish a deliberate Admin hold. A direct Admin SUSPENDED update would be undone by later completion reconciliation from lesson completion, assignment review, attempt submission or attendance correction. REVOKED must remain terminal under current policy and cannot substitute for a reversible hold.

### Smallest additive proposal

Add one field to the existing Certificate; retain the enum, existing code uniqueness, Student/Course uniqueness and foreign keys.

```prisma
// Add to the existing Certificate model:
adminSuspended Boolean @default(false)
```

Add this SQL invariant:

```sql
ALTER TABLE "Certificate"
  ADD COLUMN "adminSuspended" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Certificate"
  ADD CONSTRAINT "certificate_admin_hold_status"
  CHECK (NOT "adminSuspended" OR "status" = 'SUSPENDED');
```

No index is needed on the Boolean by itself. Actor, reason and concise before/after belong in existing AcademicAudit, not a duplicate certificate identity or authorization model.

### Implemented transition behavior

| Action                   | Behavior                                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy issuance          | Existing eligibility service only; no manufactured completion. New certificate defaults to no Admin hold.                                                                         |
| Admin suspend            | ACTIVE or already policy-SUSPENDED → SUSPENDED plus `adminSuspended=true`, atomically and audited. REVOKED rejects this action.                                                   |
| Automatic reconciliation | Never activates an Admin-held certificate. Existing policy-only SUSPENDED records can still recover when eligible.                                                                |
| Admin restore            | Clear the hold, then re-evaluate current eligibility atomically. Eligible records become ACTIVE; ineligible records remain SUSPENDED with no Admin hold. REVOKED rejects restore. |
| Admin revoke             | Set REVOKED and clear the hold in the same transaction; audit both changes. Reconciliation cannot undo revocation.                                                                |
| Student access           | Existing ACTIVE status plus current authorization/eligibility remains required. Suspended/revoked certificates stay unavailable.                                                  |

The hold affects certificate availability only, never Student learning completion, Enrollment status or first completion timestamp. No fake PDF, certificate designer or public verification portal.

## 3. Exact migration and data impact

One additive migration contains:

1. One new `AcademicResponseReview` table, its primary key, two restrictive foreign keys, one reviewer/time index, point/feedback checks and INSERT/UPDATE context validation and DELETE-history guards.
2. One `Certificate.adminSuspended` Boolean with false default and one status-consistency CHECK.

Prisma inverse relations generate no extra columns/tables. No new enum, duplicate identity, destructive DDL, submitted-answer mutation, recording change or existing-row UPDATE/backfill script. The review table starts empty, so existing submitted text responses remain pending. Existing certificate records receive the false default and retain their current policy semantics; no existing suspension is retroactively inferred to be an Admin hold.

Only guarded loopback `mentoralm_dev/public` and disposable schemas in separate `mentoralm_test` were used. Existing migrations and submitted response/option immutability guards are unchanged. No production connection or deployment.

## 4. Remaining A3 workflows inspected

| Workflow                     | Current reusable capability                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attendance                   | BatchSession + membership-window checks + AttendanceRecord + AcademicStaff transaction. Correction context/reason can use concise AcademicAudit details. Per-record bounded bulk feedback needs no new model. |
| Assignment review            | Immutable SubmissionVersion/files plus appended AssignmentReview; latest-version and authorized-staff validation already exists.                                                                              |
| Discussions                  | Existing `locked` field; immutable post/context guards. Lock/unlock fits; hide/remove states will not be invented.                                                                                            |
| Support                      | SupportTicket statuses, SupportMessage server sender FK and STAFF actor; existing Student ownership/reply rules remain intact.                                                                                |
| Communications               | BatchCommunications resolves actual Batch audience with channel/purpose consent; Message/Delivery persist PENDING_PROVIDER or SUPPRESSED only. Other audience scopes/provider sending remain unavailable.     |
| Referrals                    | Existing identity/attribution; read-only inspection, no unsupported attribution correction or source field.                                                                                                   |
| Operations overview / audits | Bounded counts/queues over existing models and existing AcademicAudit; no A4 audit explorer.                                                                                                                  |

## Validation and stop state

Clean-install and populated-upgrade migration tests passed. The approved review and certificate invariants, operations authorization/IDOR/consent tests, and simultaneous review/correction tests pass against isolated PostgreSQL. Development Prisma migration diff reports no difference. Full results and A4 deferrals are recorded in `ADMIN-A3.md`.
