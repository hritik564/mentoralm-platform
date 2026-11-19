# Marketplace M3 — private pre-payment enrollment

M3 extends approved M1/M2 on `marketplace-v1`, base `53638b2`. It stops before money, purchase state and learning access. No Production connection, seed, commit, push, publish or deployment.

## Architecture and routes

Published OPEN program with an announced price → server-owned intent → existing Clerk account → secure claim → four saved onboarding steps → `/checkout/[intentRef]`.

`POST /api/marketplace/enrollment` accepts **only `{slug}`**. It reads the canonical Published Offering in a serializable transaction, snapshots commercial fields and returns an allowlisted destination. An authenticated MentoraLM User proceeds directly; there is no Student-only role or LMS entitlement prerequisite for buying a public program. Existing Clerk identity, provisioning, WebsiteAccount, Navbar and account menu remain the authority. No identity system or admin operations UI is added.

Private routes are dynamic and noindex, have no canonical public URL and never read/write a public cache. API responses, including errors, are `private, no-store`. Server failure boundaries show a retry/support state without exposing raw exceptions. Unsupported write methods are not exported.

## Data model and migration

Exact models and enums are in `prisma/schema.prisma`:

- `MarketplaceIntentState`: ACCOUNT_REQUIRED, ONBOARDING_REQUIRED, READY_FOR_CHECKOUT, EXPIRED, CANCELLED. STARTED is represented by account/onboarding-required; there is no paid or completed purchase state.
- `MarketplaceEnrollmentEventKind`: EnrollmentIntentCreated, EnrollmentIntentClaimed, EnrollmentOnboardingUpdated, EnrollmentReadyForCheckout, EnrollmentIntentCancelled.
- `MarketplaceEnrollmentIntent`: internal cuid PK, unique 256-bit publicRef, UUID revision; nullable User FK and anonymous browserHash; restricted Offering FK; title/priceMinor/currency/duration/delivery-mode/cohort timestamp snapshot; state, immutable expiry/creation timestamp and updated timestamp. Indexed by User/Offering/expiry and browserHash/Offering/expiry.
- `MarketplaceEnrollmentOnboarding`: intentId PK/FK, one submission per intent; completedStep 0–3, bounded nullable fields, consentVersion/completedAt pair and timestamps. Ownership derives exclusively through the intent, avoiding an independently mutable duplicated userId. Its concurrency revision is the parent intent UUID.
- `MarketplaceEnrollmentEvent`: append-only cuid PK; restricted intent and optional actor FKs; event kind, before/after state, constrained changed-field names and timestamp. Indexed by intent/time. No payload/PII JSON column.

Migration: `20261119090000_marketplace_enrollment_intents`.

SHA-256: `1e02ac02df16437b79c45d0619c13c78baa8a74986f35dd5f985bdb2abba85de`.

Eighteenth forward-only migration: **two enums, three tables, four indexes including the unique public reference, five restricted FKs**, bounded quote/identity/expiry/onboarding/event checks, immutable quote/claimed-owner trigger, append-only audit triggers and deferred ownership/readiness checks. User and Offering inverse relations require no changes to those existing SQL tables. No existing rows are backfilled or rewritten. No historical SQL/checksum changed.

The guarded `npm run db:migrate:m3:local` verifies local mode, Development identity keys, origins, exact loopback `mentoralm_dev/public`, release history and that only this exact migration is pending. Historical M1/M2 commands refuse a newly pending M3 migration. The release manifest includes the new checksum.

Clean isolated Test migration, populated M2→M3 upgrade with byte-equivalent existing rows, zero automatic intent/submission/event rows, and schema drift were tested. Development applied exactly this one migration, total 18. A repeat invocation applied `[]`; Development contains zero Marketplace offerings/pages/versions/intents/submissions/events and has no Prisma drift. Test execution uses the existing guard: local `_test` database, ALLOW_DATABASE_TESTS=1, rejection of the runtime database, random per-run schema and schema-verified teardown. No Development test fixtures.

## Lifecycle, quote and duplicate rules

Lifetime is **24 hours** from server creation. Anonymous starts are ACCOUNT_REQUIRED; verified claims bind the owner and become ONBOARDING_REQUIRED. Final validated review is READY_FOR_CHECKOUT. Editing a completed submission clears its completion/acknowledgement and returns to onboarding-required. Cancellation is explicit and audited. EXPIRED is evaluated on access; reads do not mutate history or require cron.

A quote snapshots the current Published Offering's integer minor-unit price, currency, title, duration, mode and one optional offering-level start timestamp. No program content is copied. Zero is valid, never an access grant. Null price blocks start and subsequent continuation. Only OPEN can start; private, archived, CLOSED, WAITLIST and COMING_SOON cannot proceed. Every mutation and checkout rechecks current publication/availability/announced-price status. Republished/reopened offerings can proceed again only while the original intent remains valid.

Existing quotes do not change if price/currency/title/cohort changes. New starts receive the current quote. Compatible unexpired active intents are reused for the same owner (or same anonymous browser proof) and exact commercial tuple. Expired/cancelled or commercially different intents allow a fresh quote. Scoped advisory locks plus serializable retries prevent concurrent duplicate starts and stale writes. Concurrent edits accept only one matching revision. Expiry is not extended by claiming, editing or signing in. Audit and domain writes commit together.

## Account return and ownership

The opaque URL reference is a locator, never sufficient authorization. Anonymous creation sets a host-only HttpOnly SameSite=Lax 256-bit browser cookie for 24 hours; Production uses a Secure `__Host-` cookie. Only a domain-separated SHA-256 digest is stored. Starting again refreshes the browser cookie lifetime so a later quote retains its proof for its full lifetime; the server-owned quote expiry never changes. Cookies are not credentials in URLs or client storage.

The existing sign-in/sign-up destination sanitizer allows only exact `/enroll/<43 base64url characters>` and `/checkout/<43 characters>` paths. External origins, queries, fragments, extra path segments and encoded redirect tricks remain rejected. An unauthenticated checkout returns through enrollment so the claim boundary cannot be skipped. Existing account/password/logout behavior is unchanged.

Claim requires a valid existing Clerk session, provisioned MentoraLM User, creating-browser proof, active offering/expiry and expected revision. Binding is atomic; it clears the stored browser proof. Same-owner retries are idempotent, and neither another account nor the consumed proof can rebind a claimed row. The browser cookie may remain for other anonymous intents; it is no longer authority for a bound intent. Losing an unclaimed browser cookie requires starting again. No new Clerk users or identity changes are performed by tests.

Owned reads/writes/checkout compare persisted User ID. Malformed, unknown and unauthorized references use the same safe unavailable/404 behavior. Browser tests also verify a shared checkout URL returns an anonymous browser to sign-in rather than disclosing details.

## Onboarding and checkout

1. About you: confirmed full name, international phone normalized to E.164, city, state/region and country.
2. Education/current status: bounded education/status enums and optional institution/organization.
3. Goal: 10–1500 characters; optional source up to 200 characters.
4. Review: explicit acknowledgement for processing this enrollment and selected-program communication, versioned `enrollment-details-v1` and timestamped at completion.

Clerk name and verified primary phone are prefilled for confirmation. Compatible existing StudentProfile education/institution values are prefilled. This submission is specific to the selected intent and does **not** overwrite the permanent StudentProfile. DOB/age is not collected. No marketing opt-in or payment/legal agreement is implied.

Each server-validated step persists; refresh/resume via the opaque reference works until expiry. A single parent revision protects all updates. Strict schemas reject arbitrary fields, client prices/owners/states, HTML/control characters, invalid enums and excessive values. Required fields are revalidated before completion. Completed steps remain editable; saved edits require review again. Only completed steps persist: unsaved in-progress typing is intentionally local.

The wizard has a semantic step list/current step, bounded labelled inputs, keyboard navigation, visible focus, error summary and field errors, focused step headings and responsive layouts. Checkout shows the saved program price/currency, duration/mode/start date, authenticated account and confirmed submission. There are no invented tax/fee lines. Continue to Payment is disabled with an honest explanation. Edit details and audited cancellation are available.

## Security, privacy and rate limiting

Existing same-origin JSON mutation protection and streamed 16 KiB body limit are reused. Domain-owned state, optimistic revisions, secure one-time claiming and database invariants protect against replay, fixation, mass assignment, quote tampering and IDOR. Private data never enters Next public caches, Marketplace generation state, public projections or Upstash Marketplace cache keys.

Dedicated rate policies use the existing limiter abstraction: creation 20/minute per User/browser, onboarding/claim/cancel 60/minute per User, and anonymous admission 120/minute globally before per-browser start checks. Production remains distributed Upstash and fails closed; local/test use the existing bounded local limiter. Global anonymous admission is deliberately conservative and needs operational traffic tuning before a public launch; browser-cookie cycling cannot bypass it. No spoofable forwarded IP is trusted.

Audit records contain only linked intent/actor, state transition and allowlisted field names. Phone/name/goal/source values are never event metadata. Events are append-only at PostgreSQL, audit failure rolls back the mutation and created/completed/claimed/cancelled events are covered. Expiry is derived, so there is no pretend expiry audit event from a GET. Domain/API/page errors suppress raw payload/provider exceptions. Public references are normalized away by existing safe request-log route grouping.

## Verification and review evidence

Final results are recorded below after execution. Ignored evidence: `docs/reviews/marketplace-m3/`. `capture-manifest.json` lists the final 16 captures; desktop/tablet/mobile widths 1672, 1440, 1024, 820, 390 and 320. It includes about-you, errors, mobile education interaction, goal, review, checkout, expired and closed states. Account email/avatar areas are masked in review captures; form answers are synthetic Test fixtures. Screenshots were visually inspected. Existing Clerk Development owner sessions only; run-created sessions are revoked, and all business fixtures are discarded with their Test schemas.

The owner independently changed homepage top spacing during this task and explicitly requested preserving it. M3 did not author that CSS change. The existing hero-preservation test's expected style hash was updated to this approved baseline; all other protected hero/artwork/navigation bytes remain guarded. The owner reference image is untouched and not a build dependency.

| Check                                                       | Executed result                                                                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:validate`                                       | Pass                                                                                                                                           |
| Clean Test migration + historical M2 upgrade + schema drift | Pass (included in M3 domain suite)                                                                                                             |
| `npm run test:m3:domain`                                    | **55 passed**, 0 failed/skipped                                                                                                                |
| `npm run test:m1:domain`                                    | **77 passed**, including cache/generation/Autoscale and security                                                                               |
| `npm run test:m2:domain`                                    | **80 passed**, including editorial/permission/security                                                                                         |
| Shared Admin navigation/dashboard/A1/A2 domain regressions  | **36 passed**                                                                                                                                  |
| `npm run test:p1`                                           | **12 passed**                                                                                                                                  |
| `npm run test:p1:providers`                                 | **12 passed**                                                                                                                                  |
| `npm run test:p1:runtime`                                   | **2 passed**                                                                                                                                   |
| `npm run test:m3`                                           | **1 complete E2E scenario passed**, real Clerk return, cookie renewal, claiming, mobile wizard, refresh, checkout, expiry/closure/cancellation |
| `npm run test:m1`                                           | **4 browser tests passed**, including existing account/Admin flows                                                                             |
| `npm run test:m2`                                           | **6 browser tests passed**, public pages and Admin editorial flows                                                                             |
| Homepage/navbar Playwright config                           | **36 passed, 1 existing desktop-inapplicable mobile case skipped**                                                                             |
| M3 axe AA checks                                            | **10 analyses, zero violations**, desktop/mobile and normal/error/status steps                                                                 |
| Typecheck / lint                                            | Pass, zero lint warnings                                                                                                                       |
| Scoped Prettier / `git diff --check`                        | Pass                                                                                                                                           |
| Provider-free optimized build                               | Pass, no database/Clerk/Redis/Better Stack credentials; zero dependency-unavailable build events                                               |
| Normal final optimized build                                | Pass; restores the local runtime public-configuration contract                                                                                 |
| Existing source/history/client secret scan                  | **0 findings** across 670 source files, 1055 historical blobs and 65 client JS files; **0 private environment-value matches**                  |
| Guarded Development verification                            | 18 exact migrations, no drift, zero Marketplace/M3 business fixtures                                                                           |

Logs and the screenshot manifest are under the ignored review directory. The complete final M3 E2E was rerun after validation/cookie/currency changes. The initial M1 browser attempt correctly refused a build/runtime public-configuration mismatch; it passed all four cases after rebuilding with the harness's normal configuration. Early PostgreSQL failures led to explicit advisory-lock result casting and schema-qualified trigger lookups; both clean migration and historical upgrade then passed. No Production auth/configuration was weakened.

For local owner review, open `http://127.0.0.1:3000/courses`. No offerings are seeded. Use the existing Marketplace-authorized Admin workflow to create/publish an OPEN program with an announced price before exercising Enroll Now. A new Clerk account is not necessary.

## Limits and M4 deferrals

This is a complete **pre-payment** journey, not a purchasing system. No gateway, Order, Payment, PaymentAttempt, webhook, entitlement, LMS Enrollment/progress unlock, refund, coupon, subscription, invoice, GST engine, manual payment approval or purchased-program dashboard state is added. There is no waitlist or multi-cohort selector. Resume is via a valid intent reference and compatible repeat CTA, without a dashboard redesign. No admin intent browser, marketing automation, cleanup cron or PII retention/deletion policy is invented.

Before any future payment launch: implement M4's authoritative order/payment reconciliation and final availability/price/tax/terms validation, establish an owner-approved retention policy and tune anonymous admission for actual traffic. Production migrations/deployment are not performed in M3. Existing optional LMS Course association has no effect on this intent or on student access.
