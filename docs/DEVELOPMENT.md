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

Supply a development PostgreSQL `DATABASE_URL` in ignored `.env.local`; never paste credentials into chat. Clerk Development keys still authenticate the Dashboard. Install generates the ignored typed Prisma client; generation and schema validation do not need a connection. Run `npm run db:migrate` to apply committed migrations only to the intended development database, then build/start. `db:migrate:dev` is a developer authoring tool with reset/shadow-database implications; never point it at production. Initial migration has no runtime/demo seed.

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

Two additive migrations follow D4: `20261001005000_instructor_role` and `20261001010000_lms_foundation`. Enum extension is committed before the new tables use INSTRUCTOR, consistent with [PostgreSQL's enum transaction rule](https://www.postgresql.org/docs/current/sql-altertype.html). `npm run db:migrate` applies them to the configured local `mentoralm_dev`; never reset D4 tables. Student IDs are database-issued and existing students are backfilled automatically. Future ORM-generated migrations must preserve the custom issuance trigger, sequence and SQL checks.

```sh
npm run test:l1:domain
npm run build
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm run test:l1
npm run test:d4:domain
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm run test:d4
```

L1 uses the same local `mentoralm_test` opt-in, random-schema guards, test server at 3100, Clerk Development users and teardown as D4. Its upgrade fixture starts with populated D4 tables inside a disposable test schema, baselines only that test schema, applies additive migrations, and verifies identity/profile preservation. Fixtures are never created in development runtime. `test:l1` inspects desktop/mobile plus an intermediate tablet viewport and captures only five core views plus one populated outline. LMS normally contains only the logged-in student's real enrollments and memberships; it may legitimately be empty. No new environment key/provider is required for L1.

## L1 domain/access configuration

`20261001020000_lms_entitlement` adds nullable User LMS override and disabled-by-default Batch access without resetting data. Apply with `npm run db:migrate` to local mentoralm_dev. Existing students remain inherited; enrollment or login alone no longer enables LMS. Only authorized internal business-data fixtures/operations can set an ENABLED override or enable an applicable active batch; there is no student setter or Admin interface.

For a future authorized production deployment, configure **both** `NEXT_PUBLIC_SITE_URL=https://mentoralm.com` and `NEXT_PUBLIC_LMS_ORIGIN=https://students.mentoralm.com`, then rebuild. Route both TLS hostnames to this same application; LMS-root/course rewrites and controlled cross-domain links are already implemented. Dashboard and Support stay on the website origin. Leave LMS origin unset for current local same-host `/learn` development; distinct loopback HTTP origins are permitted for local host testing. No DNS or deployment is changed by L1.

Use the same Clerk production instance/keys with mentoralm.com as the root domain and students as an approved subdomain. Clerk documents [shared sessions across subdomains](https://clerk.com/docs/guides/dashboard/dns-domains/satellite-domains) separately from satellite domains; a second satellite application/identity store is unnecessary. Configure its [subdomain allowlist](https://clerk.com/docs/guides/dashboard/dns-domains/subdomain-allowlist), required Clerk DNS/TLS and approved redirects/OAuth settings during the deployment phase. Verify real login, logout and recovery across both hosts then; localhost host-header tests prove routing and server denial, not production DNS/session-cookie readiness. Keep the same PostgreSQL User mapping and business entitlement, never Clerk metadata.
