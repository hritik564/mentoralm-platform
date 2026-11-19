# Marketplace M3 exact file inventory

Branch `marketplace-v1`, base `53638b2`. No staging, commit, push, publish or deployment.

40 M3 files changed/added:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MARKETPLACE-M3-FILES.md`
- `docs/MARKETPLACE-M3.md`
- `package.json`
- `playwright.marketplace-m3.config.ts`
- `prisma/migrations/20261119090000_marketplace_enrollment_intents/migration.sql`
- `prisma/schema.prisma`
- `scripts/marketplace/migrate-enrollment-local.ts`
- `scripts/marketplace/safety.ts`
- `src/app/api/marketplace/enrollment/[[...path]]/route.ts`
- `src/app/checkout/[intentRef]/error.tsx`
- `src/app/checkout/[intentRef]/page.tsx`
- `src/app/enroll/[intentRef]/error.tsx`
- `src/app/enroll/[intentRef]/page.tsx`
- `src/components/marketplace/enrollment/CheckoutSummary.tsx`
- `src/components/marketplace/enrollment/EnrollButton.tsx`
- `src/components/marketplace/enrollment/EnrollmentError.tsx`
- `src/components/marketplace/enrollment/EnrollmentFlow.tsx`
- `src/components/marketplace/enrollment/EnrollmentShell.tsx`
- `src/components/marketplace/enrollment/EnrollmentSummary.tsx`
- `src/components/marketplace/program/ProgramAction.tsx`
- `src/components/marketplace/program/presentation.ts`
- `src/lib/auth/redirects.ts`
- `src/lib/marketplace/enrollment/page.ts`
- `src/lib/marketplace/enrollment/server.ts`
- `src/lib/marketplace/enrollment/service.ts`
- `src/lib/marketplace/enrollment/types.ts`
- `src/lib/marketplace/enrollment/validation.ts`
- `src/lib/production/migrations.ts`
- `src/lib/student/mutation-policy.ts`
- `src/styles/marketplace-enrollment.css`
- `src/styles/marketplace-program.css`
- `tests/marketplace-editorial.test.ts`
- `tests/marketplace-m2.spec.ts`
- `tests/marketplace-m3-domain.test.ts`
- `tests/marketplace-m3-security.test.ts`
- `tests/marketplace-m3.spec.ts`
- `tests/marketplace-scope.test.ts`
- `tests/production-p1.test.ts`

Separately preserved owner change: `src/styles/homepage-hero.css` (top-spacing adjustment explicitly approved during M3). Its existing preservation-test hash is updated in the M3 inventory above. The untracked `Reference/homepage-hero-approved.png` remains untouched and excluded from this inventory. Ignored generated Prisma/build artifacts and `docs/reviews/marketplace-m3/` evidence are not committed source files.
