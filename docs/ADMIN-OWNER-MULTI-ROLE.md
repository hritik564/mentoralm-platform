# Owner multi-role completion report

Completed locally on 2 October 2026. Same existing Clerk Development identity and MentoraLM User. No new owner identity/User, permanent business fixtures, production connection, deployment, push or A2 work.

## 1. Exact additive schema

Existing `User.role Role @default(STUDENT)` remains the primary persona; its existing `@@unique([id, role])` and all Student/Instructor domain relationships remain unchanged. The only User addition is `roleAssignments UserRoleAssignment[]`.

```prisma
model UserRoleAssignment {
  userId    String
  role      Role
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Restrict)

  @@id([userId, role])
  @@index([role])
}
```

Reuses existing STUDENT / ADMIN / INSTRUCTOR enum. Timestamp follows User's existing Prisma timestamp convention. RESTRICT avoids silently deleting persisted authority when an identity is removed/renamed. No Boolean capability, new identity model or automatic primary-role duplication/backfill.

## 2. Migration

`20261002190000_user_role_assignments`: one table, composite primary key, role index and User FK. Generated schema diff contains no data rewrite, dropped column/table or backfill. Applied successfully to loopback `mentoralm_dev/public`; all nine migrations are finished, none rolled back, and Prisma reports **No difference detected**. Clean and populated A1-baseline upgrade tests pass in disposable isolated schemas of `mentoralm_test`; schemas are cleaned afterward. FK, duplicate assignment and deletion restrictions pass. Test database guard rejects development and verifies actual database identity before schema creation.

## 3. Effective-role architecture

Server-only `src/lib/auth/roles.ts` supplies fresh `getEffectiveRoles`, `hasRole` and `requireAdmin`. Effective roles are the primary persona plus persisted assignments. Admin entry/layout, repository, transaction mutations, recording services and existing LMS Admin branches all use this abstraction. Legacy primary ADMIN continues to work without an assignment. No authority comes from email, client body, URL, cookie or Clerk metadata; email is used only for the explicitly authorized local operator identity resolution.

Student LMS retains primary STUDENT, business entitlement, Enrollment and published Course/content checks. Additional ADMIN does not bypass these gates. Instructor alternatives still require primary INSTRUCTOR plus applicable BatchInstructor assignment; additional INSTRUCTOR alone does not broaden teaching authority.

## 4. Owner grant

Exact existing account: `arcaderobo3@gmail.com`. Resolved against the same Clerk Development instance; required an existing MentoraLM User. The local operator created one additional ADMIN assignment. Final primary role is **STUDENT**, effective roles **STUDENT + ADMIN**. Owner remains authorized after the real-session revoke/regrant test. No User/Clerk creation or primary-role change.

Local access: `http://127.0.0.1:3000/admin`, using the owner's usual existing Clerk Development sign-in. Authorized entry bypasses `/admin-auth/sign-in` to `/admin`.

## 5. Student preservation proof

Before/after canonical SHA-256 digests match, including User scalar values, Student ID/entitlement, memberships, Enrollments, attendance, lesson states, academic attempts/responses, submissions/versions and certificates:

`fa79fe67608e51e71bb844c3d340cd302ad5bc9043e2fa6f894efdbab4f94b94`

| Fact                                           | Before and after    |
| ---------------------------------------------- | ------------------- |
| Primary persona                                | STUDENT             |
| Student ID                                     | MLM-STU-2026-000001 |
| Memberships                                    | 1                   |
| Enrollments                                    | 1                   |
| Attendance records                             | 5                   |
| Lesson states                                  | 3                   |
| Academic attempts / submissions / certificates | 0 / 0 / 0           |

Digest also matches the initial operator grant result. Counts are supporting evidence; full persisted scalar history is compared, not just counts. Private before/after evidence stays in ignored `docs/reviews/admin-owner/student-preservation.json`.

## 6. Admin authorization and auth UX

Real owner session verified `/admin`, `/admin/students`, opaque Student detail, `/admin/batches`, opaque Batch detail and Live Sessions. Same-session audited revoke immediately returns API 403 and intentional Access denied on both Admin entry and `/admin`; no Student redirect or sidebar is exposed. Regrant immediately restores Admin entry bypass.

Anonymous Admin sign-in and native Admin Host routing verified locally; no production request/DNS change. Mentora. / Admin Console branding, no public signup CTA, shared Light/Dark with reload persistence, account logout, anonymous API 401, and subsequent real sign-in bypass pass. Existing Clerk-controlled recovery/verification design retained; no password reset email was sent or password changed. Test sign-in uses short-lived Clerk Development testing tokens; only newly created testing sessions/tokens are revoked afterward.

Student-only, Instructor-only and missing persisted User are denied in domain tests. Legacy ADMIN and Student + ADMIN are allowed. Strict client role claims are rejected; real revoked-owner body/query/cookie attempts cannot self-promote (403). Authorized POST to the nonexistent role-management endpoint returns 404. No role-promotion API/UI exists.

## 7. LMS regressions

Same owner opens `/dashboard`, `/learn` and their existing enrolled Course. Removing only the additional ADMIN assignment preserves Dashboard/LMS access and the full history digest. Isolated tests also prove additional ADMIN cannot substitute for missing LMS entitlement or Enrollment. D4 and L1–L4 authorization, IDOR, concurrency, progress, assessment/submission history, attendance, completion, communications and recording-policy regressions pass.

## 8. Safe operator CLI

From this project, with ignored `.env.local` holding Clerk Development keys and loopback `mentoralm_dev/public`:

```sh
npm run dev:admin-role -- grant arcaderobo3@gmail.com
npm run dev:admin-role -- revoke arcaderobo3@gmail.com
```

Exact existing Clerk `user_…` IDs are also accepted. Strictly two arguments; only grant/revoke of additional ADMIN. No User/Clerk creation, primary-role mutation or other assignments are changed. Guard rejects nondevelopment/deployed environments, production Clerk keys, deployed website/LMS/Admin origins, remote PostgreSQL, wrong database/schema and connection overrides. Verifies actual `current_database()` / `current_schema()` before lookup/write. Serializable transaction retries existing concurrency conflicts. Duplicate grants/revokes are no-ops for role state; each invocation remains audited. Revoke does not remove legacy primary ADMIN authority.

Migration command: `npm run db:migrate:a1:local` (same guarded local target; no production command used).

## 9. Audit behavior

Every successful operator invocation writes `LOCAL_ADMIN_ROLE_GRANTED` or `LOCAL_ADMIN_ROLE_REVOKED` in the same transaction as assignment change, including idempotent no-ops. Actor/target refer to the resolved existing User, with source `local-development-operator`, operation, role, primary persona and changed flag. This is an explicitly authorized local privileged operator action, not an authenticated self-promotion endpoint. Audit insertion failure rolls back the assignment. Real owner revocation/regrant actions remain in the audit trail; no historical audit was erased.

## 10. Executed validation

- Prisma generation, format and schema validation: passed.
- Guarded development migration and schema drift check: passed; nine finished migrations, no drift.
- Combined PostgreSQL/domain regression run: **88 passed, 0 failed, 0 skipped** across roles/migration, A1/migration, D4, L1–L4, LMS auth and account suites.
- Real-owner Playwright: **2 passed**, covering all owner routes, same-session revoke/regrant, self-promotion denial, both themes, logout and sign-in.
- Six axe analyses (two auth themes plus four owner Admin captures): **0 violations**; no horizontal overflow.
- Typecheck, lint, repository format check, production build and whitespace diff check: passed.

Old D4/L1/L3 test migration-count assertions were updated from a hard-coded seven to the actual repository migration count. A migration safety assertion was corrected to distinguish SQL statements from `ON DELETE/UPDATE RESTRICT`. No authorization was weakened. The existing PostgreSQL adapter emits a non-failing concurrent-client-query deprecation warning; no dependency upgrade is part of this pass.

## 11. Captures and scope stop

All 1440×1000, real existing owner/business data, ignored under `docs/reviews/admin-owner/`; visually inspected:

- `1440-sign-in-light.png`
- `1440-sign-in-dark.png`
- `1440-overview.png`
- `1440-students.png`
- `1440-student-detail.png`
- `1440-batch-live-sessions.png`

Production host/Clerk cross-domain setup remains deployment work; production was never contacted. Recording provider integration and shared production rate limiting remain the previously documented A1 infrastructure requirements. Auth UX was not redesigned. A2 remains unstarted.
