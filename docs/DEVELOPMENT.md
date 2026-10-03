# Development workflow

## Repository status

The repository now contains the W1/W2 public frontend. Use Next.js App Router, React, strict TypeScript, and the existing npm lockfile. Only the homepage and shared frontend foundation are authorized. Do not initialize future systems.

Read [../AGENTS.md](../AGENTS.md), relevant domain documents, and [Decisions](DECISIONS.md) before work. Website is first; other surfaces remain deferred unless explicitly requested.

## Change discipline

1. Inspect relevant files and understand current behavior.
2. Confirm requested scope and identify affected domain and trust boundaries.
3. Surface ambiguity that materially affects architecture instead of inventing policy.
4. Make the smallest coherent change; avoid unrelated redesign and future-phase implementation.
5. Run relevant validation or tests that actually exist.
6. Review the diff and report changes, verification, and limitations accurately.

Update documentation and accepted decisions when approved changes affect them. Record assumptions separately. Proposals are not authorization to implement another phase.

## Validation expectations

For documentation, review links, consistency, scope, state ownership, security principles, and absence of unapproved stack decisions or implementation artifacts.

When implemented, important business rules, authorization, cross-user access, enrollment lifecycle, learning progress, and assessment scoring require meaningful tests. Bug fixes should include regression tests when practical. Select validation appropriate to the affected behavior and do not claim unexecuted tests passed.

## Environment and dependencies

Keep environment-specific configuration separate from business logic. Never hardcode production credentials, commit secrets, or expose secrets in client bundles. Document required configuration and safe examples after the stack is approved; do not invent provider configuration now.

Dependencies need concrete justification. Prefer maintained and well-supported packages, avoid duplicating stack capabilities, and explain significant infrastructure additions. Next.js, React, TypeScript, and frontend tooling are selected. Database, ORM, authentication provider, cloud service, and deployment platform remain unselected.

Use strong TypeScript types and document any necessary `any`. Keep modules small, business rules outside UI, and abstractions grounded in recurring needs.

When database work begins, use migrations, explicit relationships, appropriate constraints, and intentional indexes. Destructive schema changes require explicit approval. When APIs begin, authenticate, authorize, validate, return structured errors, and preserve established contracts.

## Local setup and checks

Use Node 24 LTS (or another version satisfying `package.json` engines) and npm. `npm ci` installs reproducibly from the lockfile. `npm run dev` starts local development on 127.0.0.1:3000. Production preview uses `npm run build` then `npm run start`. No environment configuration is required locally.

Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`. Install the browser with `npx playwright install chromium`, then run `npm test`. Playwright starts its own production server on 3100; keep that port available. For a restricted environment, an explicit `PLAYWRIGHT_BROWSERS_PATH` can point to an approved writable browser cache. `npm run format` formats repository source and documentation.

The Chromium projects exercise 390×844, 768×1024, 1440×1000, and 1920×1080, plus narrow 320px checks. They cover SSR/SEO, the seven-module contract, valid origin configuration, image loading, anchor integrity, overflow, browser console errors, navigation keyboard behavior, future-feature dialog focus/closing, native opportunity disclosure, reduced motion, no-JavaScript readability, and axe WCAG A/AA checks. They also capture screenshots for actual visual review; automated checks do not replace manual review or prove complete accessibility/performance compliance. Firefox, Safari, assistive-technology review, and production device/network performance are still release validation work.

## Direct dependency purposes

- Runtime: `next`, `react`, `react-dom` provide public rendering and composition; `@fontsource/dm-sans` and `@fontsource/newsreader` supply locally bundled fonts without runtime font requests to third parties.
- Type checking: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`.
- Lint: maintained ESLint 10 with `@eslint/js`, `typescript-eslint`, `@next/eslint-plugin-next`, `eslint-plugin-react-hooks`, and `globals`. Rules are composed directly to avoid the older React/import/accessibility plugin peer constraints in the Next.js preset. Browser accessibility is tested with axe. See [Next.js ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint).
- Formatting: `prettier`.
- Browser testing: `@playwright/test` and `@axe-core/playwright`; development-only.

No UI component kit, animation library, CMS, analytics, database, authentication provider, or infrastructure service was added. Image resizing used the `sharp` dependency already supplied by Next.js; no extra application package was required.

## Public origin and launch preparation

The optional `NEXT_PUBLIC_SITE_URL` must be an approved absolute HTTP(S) origin without credentials, path, query, or fragment. Set it before the production build to emit a canonical homepage URL and Open Graph URL. Unset configuration omits canonical metadata instead of inventing a domain. Open Graph title/description are present; a sharing image awaits approval. Do not publish until hosting, policies, public content, and available user journeys have been reviewed.

## R1 shared presentation workflow

Import `GlassSurface` for readable dark/light/elevated surfaces. Use `interactive` only alongside real semantic interactive content; it does not assign a role or click behavior. Use the `glow-action` class on `ButtonLink` for a primary brand action. Typography role utilities and `AmbientField` are opt-in for subsequent authorized section tasks; do not apply them globally to existing scenes. Place `AmbientField` inside a positioned, isolated parent and keep important content outside decorative layers.

Use `Reveal` under the existing single `MotionObserver`; `variant="scale"` and `stagger={0|1|2}` reuse shared tokens. Server-rendered content must remain visible without JavaScript. Keep future appearance changes in the semantic token layer, `foundation.css`, or scoped `navigation.css`. `Navbar tone="light"`/`"elevated"` provides a future appearance extension point without adding section detection.

The Playwright matrix now also includes 320×740 and 1024×768, alongside the original four projects. `navigation.spec.ts` checks sticky anchoring, a stable header footprint, reduced-motion compaction, mobile focus containment, body/inert cleanup, nested Login dialog focus, and resizing back to desktop. It captures top, sticky and mobile-menu artifacts for visual inspection. Existing homepage regression and axe scans remain enabled. Final executed results are recorded in `R1-VALIDATION.md`; do not infer passing status from this workflow description.

## R2 hero workflow

Compose hero-specific server components through `HeroExperience`; keep editorial content outside the client interaction boundary. Import `hero.css` from `Hero` and `menti.css` from `Menti`. Keep the existing content models and navigation untouched. `tests/hero.spec.ts` adds geometry/readability, real destination, honest Menti dialog, pause/resume, reduced-motion tracking-reset and staged/focus screenshot checks to the existing six-width production browser suite. Owner screenshots and final executed results are recorded in `R2-VALIDATION.md`. Menti is a visual character only; no assistant service is connected.

## D1 authentication/dashboard workflow

D1 explicitly authorizes Clerk identity and the Student Dashboard shell. Use the two keys from `.env.example` in ignored `.env.local`; missing keys keep account submission unavailable and Dashboard protected. Rebuild/restart after changing Clerk keys because the publishable key and root provider availability enter the public build. Clerk owns credentials and recovery; business data, LMS and Admin remain deferred.

`npm run test:d1` runs a focused 1440px/390px suite after a production build. Development keys enable real UI signup/login/logout with temporary Clerk test accounts, deleted by exact test email in `finally`. Production instances are never mutated. Auth traces and persisted session files are disabled. The existing marketing suite is separate; no huge screenshot matrix is required for D1.

## D4 PostgreSQL setup and validation

Supply a development PostgreSQL `DATABASE_URL` in ignored `.env.local`; never paste credentials into chat. Clerk Development keys still authenticate the Dashboard. Install generates the ignored typed Prisma client; generation and schema validation do not need a connection. Run `npm run db:migrate:a4:local` to apply committed migrations only to the intended development database, then build/start. P1 disables generic `db:migrate`/`db:migrate:dev` aliases. New migration authoring requires a separately reviewed local workflow; do not use reset/shadow tools against Production. Initial migration has no runtime/demo seed.

Optional `REFERRAL_APP_ORIGIN` must be the approved HTTPS origin without path/query/credentials. Missing origin keeps the saved referral identity but disables sharing. Optional `RESOURCE_FILES_ROOT` is an operator-controlled private directory outside `public`; resources without a configured file provider show metadata without false delivery promises. Files must be scanned/validated before future Admin publication. No student upload feature exists.

For database tests supply **a separate disposable PostgreSQL database whose name ends `_test`**, `TEST_DATABASE_URL`, and `ALLOW_DATABASE_TESTS=1`. The harness permits local PostgreSQL only, refuses development targets including equivalent localhost aliases/default ports, verifies the connected database name, and creates a fresh random schema. It applies committed migrations there and drops only its own schema afterward. Playwright workers retain the server schema identity; explicit global teardown removes the schema and temporary fixture directory. Connections need schema creation/removal permission. Normal completion cleans up; after a process crash the owner may remove only leftover `d4_` test schemas in that disposable database.

```sh
npm run db:validate
npm run typecheck
npm run lint
npm run format:check
npm run test:d4:domain
npm run build
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm run test:d4
```

The browser path above refers to this workstation's existing Playwright installation; elsewhere install/use the standard Playwright Chromium browser. D4 tests start a separate production server at 3100 with an isolated schema and temporary private fixture directory. Without PostgreSQL they explicitly skip database/populated E2E checks and verify authenticated unavailable states. UI fixture tests intercept APIs to verify form contracts and accessibility only; they never establish persistence. Historical D1–D3 reports describe prior milestone validation; D4 tests supersede runtime-empty assertions, which must not be treated as current persistence evidence.

Prisma CLI transitive dependency overrides pin patched `deepmerge-ts@8.0.2` and `mysql2@3.24.5`; install/generate/validate/build are checked. Keep these overrides reviewed during Prisma upgrades. SQL checks added to the initial migration are intentional schema invariants not represented by Prisma's model syntax; preserve them in future migrations.

## L1 migration and learning validation

Two additive migrations follow D4: `20261001005000_instructor_role` and `20261001010000_lms_foundation`. Enum extension is committed before the new tables use INSTRUCTOR, consistent with [PostgreSQL's enum transaction rule](https://www.postgresql.org/docs/current/sql-altertype.html). `npm run db:migrate:a4:local` applies them to the configured local `mentoralm_dev`; never reset D4 tables. Student IDs are database-issued and existing students are backfilled automatically. Future ORM-generated migrations must preserve the custom issuance trigger, sequence and SQL checks.

```sh
npm run test:l1:domain
npm run build
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm run test:l1
npm run test:d4:domain
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm run test:d4
```

L1 uses the same local `mentoralm_test` opt-in, random-schema guards, test server at 3100, Clerk Development users and teardown as D4. Its upgrade fixture starts with populated D4 tables inside a disposable test schema, baselines only that test schema, applies additive migrations, and verifies identity/profile preservation. Fixtures are never created in development runtime. `test:l1` inspects desktop/mobile plus an intermediate tablet viewport and captures only five core views plus one populated outline. LMS normally contains only the logged-in student's real enrollments and memberships; it may legitimately be empty. No new environment key/provider is required for L1.

## L1 domain/access configuration

`20261001020000_lms_entitlement` adds nullable User LMS override and disabled-by-default Batch access without resetting data. Apply with `npm run db:migrate:a4:local` to local mentoralm_dev. Existing students remain inherited; enrollment or login alone no longer enables LMS. Only authorized internal business-data fixtures/operations can set an ENABLED override or enable an applicable active batch; there is no student setter or Admin interface.

For a future authorized production deployment, configure **both** `NEXT_PUBLIC_SITE_URL=https://mentoralm.com` and `NEXT_PUBLIC_LMS_ORIGIN=https://students.mentoralm.com`, then rebuild. Route both TLS hostnames to this same application; LMS-root/course rewrites and controlled cross-domain links are already implemented. Dashboard and Support stay on the website origin. Leave LMS origin unset for current local same-host `/learn` development; distinct loopback HTTP origins are permitted for local host testing. No DNS or deployment is changed by L1.

Use the same Clerk production instance/keys with mentoralm.com as the root domain and students as an approved subdomain. Clerk documents [shared sessions across subdomains](https://clerk.com/docs/guides/dashboard/dns-domains/satellite-domains) separately from satellite domains; a second satellite application/identity store is unnecessary. Configure its [subdomain allowlist](https://clerk.com/docs/guides/dashboard/dns-domains/subdomain-allowlist), required Clerk DNS/TLS and approved redirects/OAuth settings during the deployment phase. Verify real login, logout and recovery across both hosts then; localhost host-header tests prove routing and server denial, not production DNS/session-cookie readiness. Keep the same PostgreSQL User mapping and business entitlement, never Clerk metadata.

## L2 local learning validation

`20261001030000_lesson_delivery_progress` adds required item policy, bounded structured/media Lesson metadata, unique LessonState and LearningResource subtype with SQL invariants. Apply with `npm run db:migrate:a4:local` only to intended local mentoralm_dev; never reset. Existing L1 identities, enrollment and curriculum are preserved.

```sh
npm run db:generate
npm run db:validate
npm run test:l2:domain
npm run build
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm run test:l2
npm run test:l1:domain
npm run test:d4:domain
```

L2 tests retain the local-only mentoralm_test guards/random schema teardown. Browser fixtures create a short playable WebM, captions, PDF and raster image only in the owned temporary private directory. No fixture records/files are seeded into normal runtime. Real Clerk Development test users are deleted by exact IDs. `L2_TEST_MEDIA` is test-harness-only and is not an app feature flag. Authentication traces/session state are disabled.

Optional `LMS_FILES_ROOT` supplies private lesson/course-resource files separately from D4 `RESOURCE_FILES_ROOT`. Missing provider produces unavailable content. Optional server-only `LMS_EXTERNAL_LINKS` JSON maps approved target IDs to HTTPS URLs and `LMS_EXTERNAL_ORIGINS` lists exact comma-separated origins; both are needed for clickable external lessons. No provider or destinations are invented. Future production requires a durable streaming object-storage adapter with the same authorization boundary, publication/MIME scanning and accessible media/captions. PDF plugin support varies; separate-tab fallback is provided. Production subdomain/DNS/Clerk verification remains the L1 deployment boundary.

## L3 local academic validation

Apply additive `20261001100000_academic_engine` to intended local `mentoralm_dev` with `npm run db:migrate:a4:local`; never reset. All six committed migrations are required. The populated upgrade fixture preserves prior Student IDs, BatchMembership and completed LessonState. Ordinary runtime has no seeded question banks, attempts, submissions, attendance or certificates.

```sh
npm run db:generate
npm run db:validate
npm run db:migrate:a4:local
npx prisma migrate status
npm run test:l3:domain
npm run build
npm run test:l3
npm run test:l2
npm run test:l1
npm run test:d4
```

Browser suites share port 3100 and must run sequentially. Existing local-only `_test`/opt-in/connected-identity/random-schema guards remain authoritative; cleanup removes only the owned schema and private directory. L3 uses real temporary Clerk Development users deleted by exact IDs. The scoped staff helper runs solely against the guarded test schema; no privileged fixture route ships. Visual captures cover eight representative screens in ignored `docs/reviews/l3/`.

Optional server-only `LMS_SUBMISSIONS_ROOT` must point to a pre-created writable private directory outside `public/`; normal runtime does not invent storage. Assignment policy supports at most five files/10 MiB each (defaults three/5 MiB), with stricter configuration allowed. Plain text/PDF/raster are the initial allowlist; DOCX is not accepted in L3. Due dates are informational; no undocumented late-submission penalty. Resubmissions require policy permission and are blocked while UNDER_REVIEW or ACCEPTED. Answers use explicit Save and Submit; there is no watch telemetry, time-limit enforcement, proctoring, auto text grading or high-frequency autosave. Percentages may be rounded for display, but pass/attendance thresholds use unrounded facts.

Course final completion and certificate policy are separate opt-ins. Future authoring/publication must validate question/option configuration and invoke scoped `AcademicStaff.reconcile` after curriculum/condition changes. Original Enrollment completion time is retained on reopening/requalification; certificate suspension follows current eligibility and manual revocation remains sticky. Genuine certificate PDFs can be attached through future privileged control-plane work and delivered from `LMS_FILES_ROOT`; no PDF is fabricated for a record. Production requires durable private upload/media storage, quarantine/scanning, retention/backups, orphan cleanup, rate/abuse controls and existing domain/Clerk deployment configuration. No production/DNS change is part of L3.

## L4 final validation and deployment contract

L4 adds `20261001120000_lms_integration`; deploy additively to the intended local mentoralm_dev and never reset. The guarded mentoralm_test harness validates connected database identity before creating a random disposable schema, excludes the development database even across loopback aliases, migrates cleanly or baselines six old migrations for a populated L3 upgrade, and drops only its own schema/private directory. Browser suites use real disposable Clerk Development identities and port 3100; run sequentially. No fixtures ship in normal runtime.

```sh
npm run db:generate
npm run db:validate
npm run db:migrate:a4:local
npx prisma migrate status
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run test:l4:domain
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm run test:l4
npm run test:d4:domain
npm run test:l1:domain
npm run test:l2:domain
npm run test:l3:domain
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm run test:l3
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm run test:l2
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm run test:l1
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm run test:d4
npm audit
```

Future deployment requires one Clerk production instance, its production publishable/secret keys, the same MentoraLM PostgreSQL User mapping, a production PostgreSQL database with migrations/backups/pooling, and both `NEXT_PUBLIC_SITE_URL=https://mentoralm.com` and `NEXT_PUBLIC_LMS_ORIGIN=https://students.mentoralm.com` at build/runtime. Live Clerk publishable keys reject missing/local production-origin configuration. Route both TLS hosts to the same application, including LMS rewrites/APIs; Dashboard/Support remain on the website. No second authentication/user database or manual shared-session cookie is required.

Clerk's [production requirements](https://clerk.com/docs/guides/development/deployment/production) state that root-domain sessions support subdomains. Configure mentoralm.com as the primary root, complete Clerk's required production DNS/TLS records and custom OAuth credentials/redirect configuration, and enable the [subdomain allowlist](https://clerk.com/docs/guides/dashboard/dns-domains/subdomain-allowlist) with students. The application configures both origins as authorizedParties; allowlist intended custom redirects at Clerk too. A [satellite setup](https://clerk.com/docs/guides/dashboard/dns-domains/satellite-domains) is for different root domains and is unnecessary here. When deployment is authorized, verify real login/logout/recovery and deep learning handoff on both HTTPS hosts. Local host tests do not establish production cookie/DNS readiness. No DNS/provider setting was changed in L4.

Private `RESOURCE_FILES_ROOT`, `LMS_FILES_ROOT` and writable `LMS_SUBMISSIONS_ROOT` remain local adapters outside public with least-privilege filesystem permissions. Production must replace them with a durable private object adapter beneath existing domain authorization: opaque object keys, bounded upload/quarantine/scanning, canonical metadata, streaming/range delivery or short-lived strictly authorized download URLs, lifecycle/retention/backups and orphan reconciliation. Keep one certificate object; Dashboard and LMS reference it. Do not expose bucket/object URLs directly or migrate authorization into storage keys. Approved external learning requires `LMS_EXTERNAL_LINKS` plus exact `LMS_EXTERNAL_ORIGINS`; missing roots/registry show honest unavailable states.

No email/WhatsApp/in-app delivery worker or provider credentials are configured by L4. Future providers need verified destinations, finalized operational/marketing consent policy/UI, dispatch-time audience/consent checks, suppression/unsubscribe, idempotency, genuine provider receipts and private auditable status transitions. Shared rate storage/ingress limits, production observability/alerting, recovery drills and abuse/moderation operations are infrastructure/operational prerequisites. Admin/Instructor UI, AI Tutor, Quantum/intelligence interpretation, payments and certificate design stay deferred.

### Local LMS owner fixtures (CLI only)

The completed LMS remains protected by Clerk → MentoraLM Student → business entitlement → Enrollment. To visually exercise it locally, use an **existing Clerk Development identity**; no Clerk account or role is created or edited:

```sh
npm run dev:lms-seed -- --owner user_YOUR_EXISTING_DEVELOPMENT_ID
# Alternatively resolve an exact existing email through Clerk Development:
npm run dev:lms-seed -- --owner your-development-email@example.com
# Or set LMS_SEED_OWNER in ignored .env.local and run npm run dev:lms-seed.
```

Only loopback PostgreSQL `mentoralm_dev`, schema `public`, is accepted. The utility verifies the connected database/schema before mutations, rejects connection query overrides, deployed environments/origins and live Clerk keys, and serializes seed/reset commands with a PostgreSQL advisory lock. It is never imported by application routes. A persisted ownership audit marker saves the Student's previous entitlement override; stable account-specific IDs make repeated seeding idempotent without overwriting learning progress. The owner stays a Student. Student ID is issued by the existing database mechanism. Other identities and coursework remain untouched.

Fixtures: CareerIgnite Program → AI Tools for Career Growth → CareerIgnite OCT-26 (account-specific `CI-OCT26-…` code), one Enrollment/membership and explicit `ENABLED` override; three Sections and eleven learning items (five text lessons, one optional video metadata lesson, one private PDF lesson, Quiz, Assessment, Assignment, private worksheet Resource); five questions covering all supported types; five held Sessions with PRESENT/PRESENT/LATE/ABSENT/EXCUSED attendance; three Course/Batch discussion threads with original posts. The welcome lesson is completed through the normal domain service for Dashboard Continue Learning. Video is deliberately metadata-only and shows the normal unavailable-media state. It is optional and has no fabricated video file. The original one-page PDF is created privately with exclusive writes, never in `public`.

Missing `LMS_FILES_ROOT` and `LMS_SUBMISSIONS_ROOT` are added to ignored `.env.local` under ignored `.local/lms-owner/`. Existing roots are preserved and must resolve outside `public`. Restart `npm run dev` after first setup to load these settings. This enables the existing private PDF/resource serving and real text/file assignment submission flow. No storage URLs or answer keys are exposed through new endpoints.

```sh
# Optional certificate visual state: uses real lesson completion, attempt
# save/submission and assignment submission services, then checks eligibility.
npm run dev:lms-seed -- --owner user_YOUR_EXISTING_DEVELOPMENT_ID --completed
# Remove the fixture course context, including its owner's practice activity:
npm run dev:lms-seed -- --owner user_YOUR_EXISTING_DEVELOPMENT_ID --reset
```

The practice Assessment and Assignment deliberately use completion-on-submission policies. Written answers remain pending review, without invented grades or instructor acceptance. The Quiz requires 70%. `--completed` never directly sets Enrollment completion or creates a Certificate: the existing domain evaluator issues it after valid requirements. Certificates are record-only; no certificate PDF or download is fabricated. Repeating completed mode creates no duplicate attempts/submissions/certificate. Reset and reseed return to the default incomplete course.

Reset is transactional, scoped to the account-specific fixture context, and restores the previous override only if the seed's `ENABLED` value remains current. The User, Student ID, profile, support/referral records and unrelated Enrollments/Courses are retained. Attached non-owned authoring, other students' activity or operational records make reset fail safely. Private fixture files, submission files and local root configuration are retained to avoid filesystem deletion of unrelated files; no broad filesystem or database wipe occurs.

Open local `/dashboard`, `/learn`, `/learn/lectures`, the printed `/learn/courses/<seed-course-id>`, `/learn/assignments`, `/learn/attendance`, `/learn/resources`, `/learn/discussions`, and `/learn/certificates` at `http://127.0.0.1:3000`, signed in as the seeded account. Course content, attendance, resources and discussions are populated. Quiz/Assessment results and Assignment versions populate through interaction; Certificates are empty until eligible (or `--completed`). Batch/Student ID stay inside LMS. Dashboard Continue Learning reads real course progress.

Focused verification, intentionally destructive only to this fixture context, with final default reseed:

```sh
LMS_SEED_OWNER=user_YOUR_EXISTING_DEVELOPMENT_ID NODE_OPTIONS=--conditions=react-server npx tsx --test tests/lms-owner.test.ts
npm run typecheck
npm run lint
```

The owner integration check refuses every database except the guarded local development target, verifies repeated seeds and authorized reads, checks that answer keys are absent before submission, exercises real completion/certificate issuance, verifies reset refusal and unrelated-enrollment preservation, and leaves default fixtures available. With no explicit owner it skips that integration check and runs only guard checks. It does not run the L1–L4 browser suites or deploy anything.

## P1 runtime separation

Set `MENTORALM_ENV=local` in ignored `.env.local` for this local project. The supported `npm run start` validates configuration and the public build fingerprint before spawning Next. Isolated browser harnesses explicitly use test classification and only disposable mentoralm_test schemas. Production uses the separate Replit/Neon [deployment runbook](PRODUCTION-DEPLOYMENT.md); do not copy local secrets/files or bypass the guarded entrypoint.

P1 selected provider preparation: Replit Reserved VM compute, independent Neon Singapore PostgreSQL, server-only Upstash/Better Stack adapters. Keep provider credentials absent in local/test; those modes refuse Production provider bindings. Run `test:p1`, `test:p1:providers`, then `test:p1:runtime` after build. See PRODUCTION-PROVIDERS.md for deployment/operator boundaries. Historical phase descriptions above do not override current approved providers.
