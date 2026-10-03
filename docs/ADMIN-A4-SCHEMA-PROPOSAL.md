# A4 governance schema checkpoint

Status: **Approved by owner and implemented in A4.** This preserves the checkpoint proposal and findings at inspection time. The final implementation, validation and local-only migration are documented in [ADMIN-A4.md](ADMIN-A4.md).

The A4 request explicitly requires a stop before migration if persisted privileged governance or granular permissions are missing. Both are missing in the inspected schema. This document proposes the complete bounded change so approval can cover the actual authorization and compatibility semantics.

## Findings at checkpoint

- `User.role` is the primary STUDENT / ADMIN / INSTRUCTOR persona. `UserRoleAssignment` adds persisted roles; effective roles are their union. Keep both unchanged.
- `src/lib/auth/roles.ts` checks effective ADMIN, without a governance tier or permission grants. Admin session, A1 repositories/recordings, A2 authoring, A3 operations and several shared LMS staff/access services use that unrestricted check or an effective-ADMIN branch.
- Consequently, ordinary ADMIN cannot currently be distinguished from authority allowed to change roles/permissions. Reusing ADMIN alone for a role-management endpoint would let every existing Admin promote other users and expand authority.
- There is no platform settings model. A4 Settings can be a real, read-only readiness/configuration projection; it does not need a speculative settings table.
- `AcademicAudit` already provides actor, operation, target, time and optional details. Its only index is target/time. It has no database append-only guard. Normal application operations append, but A1/A2 test cleanup and the local LMS seed reset currently delete audit rows. Those paths must be adapted before installing an append-only guard.
- Instructors still use primary INSTRUCTOR plus BatchInstructor assignment. The BatchInstructor FK references `(User.id, User.role)`. An additional INSTRUCTOR role does not make a primary Student assignable to a teaching Batch. The minimal Instructor view must show effective roles and this assignment eligibility honestly; A4 must not silently change teaching FKs or Student/LMS scope.
- The workspace was clean at inspection; A3 is committed as `1bd971f`. Only this proposal document is added at the checkpoint.

## Exact proposed Prisma additions

```prisma
enum AdminAuthority {
  SCOPED
  GOVERNANCE
}

enum AdminPermission {
  STUDENTS_MANAGE
  BATCHES_MANAGE
  ACADEMICS_MANAGE
  ATTENDANCE_MANAGE
  CERTIFICATES_MANAGE
  DISCUSSIONS_MANAGE
  SUPPORT_MANAGE
  COMMUNICATIONS_MANAGE
  REFERRALS_VIEW
  USERS_VIEW
  AUDIT_VIEW
  SETTINGS_VIEW
}

model AdminAuthorization {
  userId      String            @id
  user        User              @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  authority   AdminAuthority    @default(SCOPED)
  permissions AdminPermission[] @default([])
  revision    String            @default(uuid()) @db.Uuid
  createdAt   DateTime          @default(now()) @db.Timestamptz(6)
  updatedAt   DateTime          @updatedAt @db.Timestamptz(6)

  @@index([authority, userId])
}
```

Add only this inverse field to existing User:

```prisma
adminAuthorization AdminAuthorization?
```

Add these indexes to existing AcademicAudit, retaining its current target/time index:

```prisma
@@index([createdAt(sort: Desc), id(sort: Desc)])
@@index([actorId, createdAt(sort: Desc), id(sort: Desc)])
@@index([action, createdAt(sort: Desc), id(sort: Desc)])
```

One bounded enum array is sufficient for the fixed platform permission set. There are no per-resource grants, nested groups, dynamic permission catalog, explicit-deny precedence or duplicate grant identities to administer in A4. Permission edits are an atomic replacement of a validated, unique set, with before/after in existing AcademicAudit. A join table can be proposed later if independent grant expiry or resource scope is actually required.

`revision` is a compare-and-set token, not a privilege. It changes to a new UUID on every policy edit. Prisma generates its initial UUID, following the existing recording revision convention; it requires no PostgreSQL extension or global revision uniqueness.

## Assignment and default-deny semantics

Authorization becomes:

Clerk session → existing MentoraLM User → effective persisted ADMIN → persisted AdminAuthorization → required permission or GOVERNANCE authority → exact resource/action checks.

- No effective ADMIN: deny all Admin access even if a policy row exists. A policy never grants the ADMIN role.
- Effective ADMIN without a policy row: deny privileged operations. No runtime legacy fallback or automatic policy creation on sign-in.
- SCOPED with an empty permission set: deny all domain operations. The authenticated Admin can receive an intentional no-assigned-permissions state rather than failing the whole shell or redirecting to Student LMS.
- SCOPED with grants: allow only the listed domain capabilities and existing resource checks. These permissions permit the named domain's supported reads and mutations; read-only permissions are explicitly suffixed VIEW. This is platform scope, not implicit Course/Batch ownership or a future resource-scoped RBAC system.
- GOVERNANCE plus effective ADMIN: unrestricted platform governance and all listed Admin capabilities. The stored permission array must be empty because authority determines the complete capability set.
- Role grants/revocations, permission edits and GOVERNANCE assignment/demotion require GOVERNANCE. There is deliberately no ordinary grantable ACCESS_MANAGE permission that could turn a scoped Admin into a governor indirectly. USERS_VIEW permits inspection only.
- Granting an additional ADMIN to a currently non-Admin creates/resets a SCOPED empty policy in the same transaction. Regrant cannot resurrect former GOVERNANCE authority or old grants. Granting INSTRUCTOR or STUDENT never creates Admin authority or changes the primary persona.
- Primary personas cannot be edited. Assignments duplicating a primary role are not offered as meaningful grant/revoke controls. A primary ADMIN remains an effective ADMIN; its operational access can still be scoped by policy.
- Removing the additional ADMIN that supplies effective ADMIN also removes its policy atomically, after lockout checks. Existing primary ADMIN cannot be removed by deleting a redundant assignment.
- Student primary persona, LMS entitlement, Enrollment, course publication, Batch scope and private-media authorization remain independent. GOVERNANCE does not bypass Student learning gates. Existing Instructor-scoped teaching authority is retained independently; an Admin endpoint cannot fall through to an Instructor path to evade its required Admin permission.

### Permission coverage

| Capability            | A1–A3/A4 coverage                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| STUDENTS_MANAGE       | Student inspection, individual LMS overrides and Enrollments                                                                           |
| BATCHES_MANAGE        | Batches, memberships, Batch LMS access, instructor assignments, operational sessions and recordings                                    |
| ACADEMICS_MANAGE      | Programs/Courses, Builder, Questions/Activities/Assignments, publishing, assignment/text-response review and their private attachments |
| ATTENDANCE_MANAGE     | Attendance queue, scoped roster and corrections                                                                                        |
| CERTIFICATES_MANAGE   | Certificate inspection, policy issue, suspend, restore and revoke                                                                      |
| DISCUSSIONS_MANAGE    | Operational discussion inspection and lock/unlock                                                                                      |
| SUPPORT_MANAGE        | Support ticket inspection, replies and status                                                                                          |
| COMMUNICATIONS_MANAGE | Consent-aware Batch audience preview, plans and delivery inspection                                                                    |
| REFERRALS_VIEW        | Read-only identity/attribution inspection                                                                                              |
| USERS_VIEW            | Existing account/persona/additional-role/access inspection; no mutation                                                                |
| AUDIT_VIEW            | Sanitized read-only audit explorer and authorized actor filters                                                                        |
| SETTINGS_VIEW         | Sanitized read-only configuration/readiness; no credential or environment-file edits                                                   |

Related selectors return only the context needed for the authorized workflow. They do not require an unrelated full-management permission or expose unrestricted list/detail DTOs. Overview metrics, recent activity and sidebar destinations are projected from allowed capabilities; a scoped Support operator cannot use Overview to read every other domain's queue or audit history.

## Existing ADMIN compatibility and migration backfill

Propose a **single, explicit migration-time backfill into the new table only** for users who already have primary ADMIN or an additional ADMIN at migration time. Give them SCOPED authority and precisely the nine current A1–A3 operational permissions, STUDENTS_MANAGE through REFERRALS_VIEW in the enum above.

This preserves existing A1–A3 operational ability and primary Student + additional Admin coexistence. It does **not** promote anyone to GOVERNANCE or implicitly grant new Users, Audit or Settings surfaces. New Admin grants after the migration default to SCOPED/empty. There is no permissive runtime fallback for users missing the row.

The existing owner consequently keeps Student + Admin and existing operations, then receives GOVERNANCE only through the separately approved explicit bootstrap below. No existing User, role assignment, Enrollment, entitlement, submission, attendance or certificate row is rewritten by the backfill.

## Owner bootstrap and lockout protection

Propose a local-only, audited, repeatable bootstrap command for the **existing owner identity**, following current Development identity resolution and database safety guards. Require an explicit existing Clerk user ID or exact Development email lookup, existing MentoraLM User, and existing effective ADMIN. Identity lookup is operator input, never an email-based runtime authorization rule. Do not create an identity, grant ADMIN implicitly, change the primary role or contact Production.

The command may initialize the first GOVERNANCE policy when none exists, or idempotently verify the same already-governing owner. It must not silently transfer governance from another user. Audit policy creation/promotion in the same transaction, recording local-operator source. Preserve and verify the owner's existing Student-history digest. No HTTP bootstrap, first-login promotion or first-Admin election.

All role/policy writes, including the existing local additional-Admin CLI, participate in a shared PostgreSQL transaction advisory lock and the existing serializable retry boundary. Acquire the governance lock before reading actor/target policy and the final-authority set. Reauthorize the acting governor, compare the confirmed current roles/policy revision, validate target, mutate and append audit in that transaction. Stale confirmations return conflict; audit failure rolls back the mutation.

- Self-demotion from GOVERNANCE and self-removal of effective ADMIN are rejected in the UI/API even if another governor exists. Another authorized governor must perform the change.
- Before changing another governor, require at least one other remaining User with both effective ADMIN and GOVERNANCE. Count identities, not role rows.
- Simultaneous removals cannot each treat the other soon-to-be-removed identity as the remaining authority: global serialization plus transactional rechecks makes one fail.
- A grant cannot restore a dormant policy; role revocation clears it. Missing, spoofed or stale policy information is never accepted as authority.
- The migration creates no governor. A zero-governor state exists only until explicit bootstrap. Application requests cannot exploit that state to self-promote.
- A4 does not expose Clerk ban/delete/password-reset administration. Role transfer verifies the candidate's Clerk identity is available and not locked/banned before granting authority. The database invariant protects persisted MentoraLM authority, not external Clerk availability: an out-of-band Clerk suspension/deletion cannot be made atomic with PostgreSQL. Document protected operator recovery and provider recovery separately; do not claim this protects against database superusers or an unavailable identity provider.

## Audit append-only proposal and compatibility work

Propose one PostgreSQL trigger function that rejects UPDATE, DELETE and TRUNCATE of AcademicAudit, with row-level UPDATE/DELETE and statement-level TRUNCATE triggers. Inserts remain allowed. Existing audit rows are preserved byte-for-byte; no new audit identity/table or raw-details backfill. This protects normal database application writes, not a database superuser who can disable triggers/drop tables.

Before installing it, adapt the two current audit-deleting paths:

1. A1/A2 browser fixture execution moves to disposable schemas in isolated mentoralm_test, as A3 already does. Cleanup drops only its verified generated schema instead of deleting audit history from Development. Retain existing assertions and real Development Clerk session validation.
2. Local LMS seed reset appends a reset audit event and derives seed/reset lifecycle from immutable events instead of deleting its seed marker. Existing seed history is not removed. This is local tooling compatibility, not a new Student feature.

The explorer uses an explicit safe projection and an operation registry for category/target interpretation. No raw details JSON is returned. Historical unrecognized operations show their safe operation/time/actor envelope without guessing a target type or disclosing bodies/IDs. Pagination uses `(createdAt, id)` ordering. No audit edit/delete endpoint, UI, or bulk audit deletion.

## Exact proposed additive migration impact

1. Create AdminAuthority enum with SCOPED / GOVERNANCE.
2. Create the fixed twelve-value AdminPermission enum above.
3. Create AdminAuthorization table, User FK with RESTRICT, userId PK and authority/userId index. Add Prisma inverse relation only to User.
4. Add SQL CHECKs for a one-dimensional permission array with no null or duplicate elements, and an empty permission array for GOVERNANCE. Use a small immutable array-validation SQL helper where CHECK expressions need it. No new identity, credential, secret, account-status or provider configuration field.
5. Insert SCOPED compatibility policies for exactly the existing effective Admin identities, with the nine explicit legacy operational grants. No automatic governance promotion.
6. Add three AcademicAudit explorer indexes and the append-only trigger/function described above. Preserve the existing target/time index and all audit data.

No dropped/renamed table or column, no Role enum change, no primary persona migration, no learning-history rewrite, no Instructor FK change, and no settings table. Validate a clean Test install, populated A3 upgrade, policy defaults/FKs/array checks, immutable audit preservation and schema drift before guarded local Development application. No Production connection, migration, deployment or push.

Final-governor and self-revocation checks are service invariants in serializable transactions under the global governance lock. A4 does not represent them as a fictitious simple CHECK constraint over other rows. There must be no unguarded alternate role/policy write path.

## Validation required after approval

Test ordinary/legacy/scoped/GOVERNANCE users, missing policy, denied-by-default new Admins, Student + Admin coexistence, primary Instructor Batch scope, and additional Instructor restrictions. Test the entire A1–A3 action/permission mapping, shared-service role-only bypass attempts, stale sessions after role/grant removal, IDOR, forged actor/roles, self-promotion, mass assignment, protected redirects/hosts/origins, oversized bodies and private files.

Exercise two-governor concurrency, final-governor removal, blocked self-demotion, stale confirmation/revision, transaction rollback on audit failure, regrant without resurrected privilege and explicit idempotent owner bootstrap. Prove audit UPDATE/DELETE/TRUNCATE denial and unchanged historical rows. Run A4 domain/migration tests, A1–A3 Admin and relevant Student regressions, representative axe in both themes, required captures at 1440/1024/820/390, Prisma/typecheck/lint/format/build and local drift verification.

Only after approval continue the A4 UI/services, read-only Settings, sanitized Audit explorer, Instructor inspection, safe bounded bulk operations, final navigation and production-readiness documentation. No live providers or deployment.

## Checkpoint stop

Approve or adjust: the one-policy model; GOVERNANCE-only access mutations; nine-grant existing-Admin backfill; explicit local existing-owner bootstrap; self/final-governor protection; and audit indexes/append-only guards with local-tool/test cleanup adaptations. Until then, do not change prisma/schema.prisma, generate/apply a migration, provision governance or enable the new access UI.
