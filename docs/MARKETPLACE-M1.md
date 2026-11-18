# Marketplace M1

Implemented for owner review on 18 November 2026. M1 adds one editorial catalogue shared by the public website and a dedicated Admin Marketplace workspace. It keeps catalogue publication separate from learning content, learning access and enrollment.

The exact change inventory is maintained separately in [MARKETPLACE-M1-FILES.md](MARKETPLACE-M1-FILES.md).

## Architecture and boundaries

`MarketplaceOffering` is the canonical source for public course/program cards. Existing LMS `Course` remains the learning-domain record. An offering may refer to an existing Course when `lmsEnabled` is enabled; it never creates or edits a Course, Enrollment or entitlement.

The new `src/lib/marketplace/` modules own shared contracts, validation, Admin operations, image checks and public reads. Business rules run on the server. Public components receive an explicit public DTO; Admin components call a dedicated authenticated API. No duplicate public catalogue array or automatic sample catalogue is introduced.

The approved homepage hero/carousel, its data, styles and artwork remain unchanged. Existing account/avatar/profile/logout behavior and authentication logic remain unchanged. The owner reference remains untracked, untouched, unread and not a runtime/build dependency.

## Schema and migration

New enums:

| Enum                            | Values                                          |
| ------------------------------- | ----------------------------------------------- |
| `MarketplaceDeliveryMode`       | `ONLINE`, `OFFLINE`, `HYBRID`                   |
| `MarketplacePublicationStatus`  | `DRAFT`, `PUBLISHED`, `UNPUBLISHED`, `ARCHIVED` |
| `MarketplaceAvailabilityStatus` | `OPEN`, `COMING_SOON`, `WAITLIST`, `CLOSED`     |

`MarketplaceOffering` contains:

| Fields                                          | Storage and purpose                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `id`, `revision`                                | CUID primary key; UUID revision for optimistic concurrency                               |
| `slug`, `title`, `shortDescription`, `category` | Unique catalogue slug and plain-text editorial metadata                                  |
| `cardImage`, `heroImage`                        | Nullable paths from eight approved existing raster assets                                |
| `deliveryMode`, `durationLabel`                 | Delivery enum and editorial duration text                                                |
| `priceMinor`, `currency`                        | Nullable nonnegative integer minor units; uppercase three-letter currency, default `INR` |
| `availabilityStatus`, `publicationStatus`       | Independent availability/publication enums; defaults `COMING_SOON` and `DRAFT`           |
| `featured`, `sortOrder`                         | Homepage selection and catalogue ordering; defaults `false` and `0`                      |
| `lmsEnabled`, `courseId`                        | Disabled by default; nullable reference to an existing LMS Course                        |
| `cohortStartsAt`, `publishedAt`                 | Nullable `TIMESTAMPTZ(6)`                                                                |
| `createdAt`, `updatedAt`                        | Required `TIMESTAMPTZ(6)` creation/update timestamps                                     |

Indexes are the primary key, unique `slug`, composite `[publicationStatus, featured, sortOrder]`, and `[courseId]`. The optional Course foreign key uses `ON DELETE RESTRICT ON UPDATE RESTRICT`; the only existing-model addition is the inverse `Course.marketplaceOfferings` relation.

The migration adds these SQL CHECK constraints:

- `marketplace_slug`: lowercase kebab-case matching `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 100 characters.
- `marketplace_price`: `priceMinor` is null or nonnegative; PostgreSQL `INTEGER` supplies the upper storage bound.
- `marketplace_currency`: exactly three uppercase ASCII letters.
- `marketplace_sort`: `sortOrder` is between 0 and 100000.
- `marketplace_lms_disabled`: an LMS-disabled offering cannot retain a Course reference.
- `marketplace_published`: Published requires `publishedAt`; an LMS-enabled Published offering also requires a Course reference.

Migration: `prisma/migrations/20261118090000_marketplace_m1/migration.sql`.

SHA-256: `0de4193dfecf817b0c56a406cd671c35968d7184b366d34cefe983896ad2cb92`.

The M1 SQL creates only the new enums, table, indexes, checks and foreign key. It contains no seeding, existing-row rewrite, enrollment activation or destructive schema operation. The release manifest preserves the approved 12-migration history, appends the original thirteenth M1 migration unchanged, then appends the two permission corrections described below (15 total). Existing readiness checks still reject checksum drift, incomplete, duplicate and unknown applied history; rolled-back rows do not count as applied. The manifest extension does not bypass those checks. Migration-count reporting now follows the verified manifest length.

## Final review permission migrations

Permissions are schema-backed by the existing Prisma/PostgreSQL AdminPermission enum. The dedicated capability therefore requires `20261118100000_marketplace_permission`, whose only statement is `ALTER TYPE "AdminPermission" ADD VALUE 'MARKETPLACE_MANAGE'`. Inspection then identified the existing fixed twelve-capability database validator; `20261118101000_marketplace_permission_capacity` replaces that function with capacity 13 while preserving one-dimensional, non-null, duplicate-free array checks and the separate empty-GOVERNANCE-array constraint. Both changes were explained before their respective local applications. Neither migration grants permissions, backfills users, rewrites offerings or changes learning data. Original M1 SQL and every earlier migration checksum remain unchanged.

Final-review local applications were exactly:

1. `20261118100000_marketplace_permission` (14 migrations complete afterward).
2. `20261118101000_marketplace_permission_capacity` (15 complete afterward).

Only local `mentoralm_dev/public` was migrated. All Test installations/upgrades use disposable schemas in isolated `mentoralm_test`. No unrelated Development migration was rerun for this correction. `npm run db:migrate:m1:permission:local` guards the exact local target, Development identity environment, pinned history and checksums; it permits only these two follow-ups pending. The original M1 operator refuses these as unrelated to its own migration. Read-only verification found 15 verified migrations, no Prisma schema drift, zero Development offerings and zero explicit SCOPED Marketplace grants. GOVERNANCE derives the capability from the registry without a stored grant.

## Local migration disclosure

The Development deployment applied **two pending migrations**, in order: the pre-existing approved `20261101093000_student_id_prefix_st`, then `20261118090000_marketplace_m1`. It is therefore inaccurate to describe the Development operation as applying only M1.

The baseline prefix migration changes existing local Student IDs from `MLM-STU-YYYY-NNNNNN` to `ST-YYYY-NNNNNN`, preserving their year and serial. It also replaces the existing issuer/format enforcement so future IDs use `ST-`. This behavior belongs to that previously pending baseline migration, not to the new Marketplace SQL.

`npm run db:migrate:m1:local` now refuses unrelated pending baseline migrations. It validates local mode, Development identity keys, local origins, the exact loopback `mentoralm_dev/public` target, release-file checksums and the existing migration prefix before deploying. It permits only M1 pending, or an already-complete history, and verifies full readiness afterward. It neither seeds offerings nor provisions identity/infrastructure.

An isolated Test upgrade from the approved populated baseline preserved the existing User, Course and Enrollment rows and produced zero offerings. Clean installations also start with zero offerings. No fake catalogue was added to Development and no runtime auto-seeding exists.

## Admin operations and security

Marketplace is a **first-class Admin domain**. Primary groups are Overview, Marketplace, Learning, Students, People, Inbox and Settings. Its own destination, layout, reads and mutations require `MARKETPLACE_MANAGE`. It is removed from Learning navigation/cards. Existing GOVERNANCE authority receives the registered capability; academic-only, legacy and other scoped policies receive no automatic grant. The existing governance policy editor may explicitly grant the capability under unchanged audited safeguards. Marketplace-only authority does not grant academic authoring.

UI paths are `/admin/marketplace`, `/admin/marketplace/new` and `/admin/marketplace/[ref]`. The list supports title/slug search, publication-status filtering and 20-row pagination. The editor exposes editorial metadata, image choices, availability, delivery, human-currency price, optional cohort date, feature/order controls and the optional existing Course association. Publication actions are explicit confirmation flows. Archived records remain visible and read-only.

The dedicated API is `/api/admin/marketplace/[[...path]]`:

| Method/path suffix      | Behavior                                                             |
| ----------------------- | -------------------------------------------------------------------- |
| `GET /`                 | Authorized list, with `page`, `q`, `status`                          |
| `GET /courses?q=...`    | Up to 50 matching existing Course choices, as opaque `ref` and label |
| `GET /[ref]`            | Authorized editable offering DTO                                     |
| `POST /`                | Create Draft; return opaque offering `ref`                           |
| `POST /[ref]`           | Save editable fields using the current UUID `revision`               |
| `POST /[ref]/publish`   | Explicit publication using `{revision}`                              |
| `POST /[ref]/unpublish` | Remove from public reads using `{revision}`                          |
| `POST /[ref]/archive`   | Archive using `{revision}`                                           |

Existing Admin authentication and persisted authorization protect reads and writes. Mutations reuse existing same-origin/CSRF checks, JSON/body bounds and academic rate limiting. Responses use the existing private JSON wrapper. Unsupported HTTP methods are not exported. Handles are typed opaque references, not exposed internal database IDs. Strict input schemas reject unknown fields, including attempts to assign publication state, internal IDs or timestamps through ordinary saves. Editorial validation bounds title to 160 characters, description to 600, category to 100 and duration to 120; text is plain rather than HTML. Cohort dates accept ISO timestamps with offsets, and price is a nullable integer from 0 to 2147483647.

`AdminMarketplace` reuses `AcademicCore.write`: each mutation rechecks permission inside the serializable transaction and writes its AcademicAudit event atomically. Failed validation, authorization, concurrency or audit insertion rolls back the business write. The five registered actions are `MarketplaceOfferingCreated`, `MarketplaceOfferingUpdated`, `MarketplaceOfferingPublished`, `MarketplaceOfferingUnpublished` and `MarketplaceOfferingArchived`. Audit details contain bounded status/context fields and changed field names, without copying descriptions, request bodies, credentials or media contents. The existing audit registry supplies readable summaries and offering title projection.

## Human currency input

The Admin field is labeled Price, with its selected currency visible and an Intl-formatted preview. `15000` or `15000.00` in INR becomes integer 1500000; `15000.50` becomes 1500050. The conversion validates decimal strings, pads according to Intl currency precision, compares decimal digits against 2147483647, then converts the already-bounded integer string. It performs no floating-point multiplication. Negative/malformed/exponent/grouped inputs, excess currency precision and overflow are rejected before submission. The API independently validates `priceMinor` as a nullable nonnegative PostgreSQL-range integer. Blank/null means To be announced; zero stays a real zero price. JPY zero-decimal and KWD three-decimal behavior is covered. Saved values round-trip to editable human prices. The database, public DTO and public formatter remain unchanged.

## Publication, availability and revisions

- Creation always produces `DRAFT`, even if a caller attempts to send publication fields.
- `DRAFT` and `UNPUBLISHED` may be published after required metadata is complete. Description, category and duration must be nonempty; LMS-enabled publication additionally requires an existing Course.
- A Published offering may be edited while retaining publication, provided it remains publishable. Ordinary edits do not publish a Draft.
- Only `PUBLISHED` may be unpublished. Archiving any non-archived state makes it terminal and read-only. There is no hard-delete or restore workflow in M1.
- Every successful save/lifecycle mutation rotates the UUID revision. The service compares the supplied revision and conditions the database update on it, so stale writers receive a conflict instead of overwriting newer work. Duplicate slugs and conflicting lifecycle transitions also fail safely.
- `publishedAt` records the latest explicit publication and is retained after unpublish/archive as history. Neither timestamp nor availability can make a non-Published record public.

Availability is display metadata independent of publication: a Published offering can show Open, Coming soon, Waitlist or Closed. These labels do not implement enrollment, applications or waitlist collection.

## Public query and presentation

`readPublishedOfferings(db, options)` is an uncached Prisma reader with a database-injection boundary for isolated tests. `getPublicOfferings(options)` supplies the application database and converts infrastructure/read failure into a sanitized `{status: 'unavailable'}` result. A successful empty catalogue is `{status: 'ready', offerings: [], total: 0, page: 1}`, distinct from unavailability.

The query always restricts records to `publicationStatus = PUBLISHED`, optionally `featured = true`. It orders by `sortOrder` ascending, `createdAt` descending, then `id` ascending, and supports bounded pagination (`page` 1–10000, `limit` 1–20). The total uses the same publication/featured filter.

The explicit `PublicOffering` DTO contains only `slug`, `title`, `shortDescription`, `category`, `cardImage`, `heroImage`, `deliveryMode`, `durationLabel`, `priceMinor`, `currency`, `availabilityStatus` and nullable ISO `cohortStartsAt`. It excludes internal IDs, opaque Admin references, revisions, LMS flags/Course associations, publication history, audit metadata and internal ordering fields.

Next.js 16.4.6 is installed and Cache Components is not enabled. The homepage no longer exports force-dynamic. Its static preview heading/frame surrounds a Suspense data boundary; `connection()` runs before database acquisition. This prevents database reads during builds without DATABASE_URL and avoids duplicate section IDs without JavaScript. The route still renders on request; this is cached data reuse, not a statically cached/PPR homepage. `/courses` keeps force-dynamic and uncached request-time reads.

`getCachedPublicOfferings()` wraps only the successful Published public DTO reader in supported `unstable_cache`, tagged `marketplace-public-v1`, with a 300-second revalidation interval. Failures throw out of the cached loader and are converted to the existing honest unavailable result outside it, so failures are not cached. Empty successful catalogues are cached. Normalized options keep equivalent requests on one key; a SHA-256 of the database target separates disposable Test schema data from Development artifacts without storing the connection string in cache keys.

Replit Autoscale is the current owner-specified topology. Next cache remains only an instance-local optimization. Shared Upstash state now provides the correctness boundary; the earlier process-local counter/fence is removed. The same database target hash only separates local Next entries, not shared authority. The production generation key is stable across processes, instances and database credential rotation.

After every successful create/edit/publish/unpublish/archive transaction, the shared generation advances; local revalidateTag(tag,{expire:0}) remains a supplementary optimization. See the shared-state protocol and recovery requirements below. Ordinary 300-second TTL refresh still uses Next stale-while-revalidate within one shared generation. Failure results never enter the cache, and already-open pages remain snapshots rather than live subscriptions.

The homepage replaces the Ecosystem preview with up to six featured Published offerings from this same reader, retaining the existing `#programs` anchor. `/courses` displays all Published offerings through 20-card pages with total-based Previous/Next navigation; it does not silently cap the catalogue at the preview size. Both surfaces use the same cards, honest empty/unavailable states and responsive layout. Public M1 has no complex filters.

The existing Navbar's user-facing Modules trigger is renamed Courses, and Explore All Courses links to `/courses`. Existing program-story links remain usable, including from `/courses` through the explicit homepage prefix. The shared account/menu controls retain their current behavior.

Cards show category, title, description, delivery, duration, optional start date, availability and fee. Prices are integer currency minor units rendered using the currency's `Intl.NumberFormat` fraction digits; a null price is shown as To be announced, and zero remains a real zero amount. M1 does not add an individual `/courses/[slug]` page. Details Coming Soon opens the existing accessible notice dialog with truthful availability text and does not imply application or payment completion.

## Media and fallback

Editors can choose only these existing local assets, or leave media empty:

```
/images/campus.webp
/images/learner.webp
/images/collaboration.webp
/images/entrepreneurship.webp
/images/counsellor.webp
/images/homepage/careerignite.webp
/images/homepage/youngminds-ai-lab.webp
/brand/mentoralm-logo.jpeg
```

The server accepts no arbitrary URL, upload or caller-controlled filesystem path. It checks the finite allowlist, statically scoped public directories, directory symlinks, `O_NOFOLLOW`, regular-file status and WebP/JPEG header signatures. Invalid or missing assets become null in the public DTO and display the branded CSS/decorative artwork fallback. `heroImage` is reserved metadata; M1 has no individual detail-page hero. Source assets are reused, not regenerated. Static public path scoping avoids whole-project Turbopack tracing while preserving these checks.

## Autoscale shared-state protocol

No Prisma schema or migration was added or changed for this topology correction. The existing Upstash configuration, strict Production environment checks and bounded server-only providerJson transport are reused. No SDK, provider, secret, environment variable or browser-facing Redis endpoint was added. Existing mutation rate limiting/readiness behavior is unchanged; upstashCommand is an additive adapter over the same HTTPS allowlist, bearer header, redirect refusal, no-store request, two-second timeout and 8-KiB response bound.

One nonexpiring Redis hash, `mentoralm:production:marketplace:public:v2`, contains a random epoch, a 64-bit decimal-string generation, a pending count and up to 64 random pending tokens. It contains no User/session/auth state, offering data, IDs, descriptions or secrets. Lua atomically validates the complete bounded shape and rejects unexpected TTLs/types/fields. All state operations use normal primary-routed EVAL, including snapshots; plain GET/EVAL_RO is not used. This follows Upstash's warning that replica reads can lag an invalidation ([consistency](https://upstash.com/docs/redis/features/consistency), [primary reads for replicated caches](https://upstash.com/blog/replicated-cache-backed-by-redis)). No live provider behavior is claimed from synthetic tests.

Read flow:

1. The existing connection()/Suspense boundary runs before any Marketplace reader/provider/database access. The constructor performs no network or environment validation at import.
2. Read a shared snapshot. Missing, malformed, dirty or unavailable state goes straight to the existing uncached Published database reader for that request.
3. A clean snapshot selects the Next key using stable scope + shared epoch + generation + normalized public options. Equal generations reuse the local DTO cache without another PostgreSQL query.
4. Check shared state again after awaiting the cached result/error. A changed generation retries; unknown/dirty coordination discards the cache result and reads PostgreSQL. Retries are bounded at 3, then use an authoritative read.
5. Reader/database failure is sanitized by publicResult into the existing unavailable state. Neither provider failure nor database failure is cached. Old in-flight fills can populate only old generation keys, which subsequent requests cannot select.

Mutation flow:

- The existing authorized Marketplace API dispatches every create/edit/publish/unpublish/archive through withMarketplaceMutation. Authentication, capability checks, same-origin body validation, limiter, opaque references, strict field validation, revision checks and database/audit transaction remain unchanged.
- In Production, acknowledge a shared pending token before database work starts. Missing/unavailable coordination refuses that write before invoking the service. A pending snapshot makes every instance use authoritative database reads, including the commit-to-generation window.
- Once the service's database/audit transaction resolves successfully, one atomic Lua operation HINCRBYs generation and removes only its own pending token. Repeating finalization for the same token is a no-op, so a lost Redis acknowledgment cannot double-increment.
- Known domain rejections abort only their own token without incrementing. Unknown database errors may have ambiguous COMMIT outcomes and retain the token. Postcommit Redis failure either leaves old state dirty or has already advanced it; both paths prevent trusted stale-cache reuse. A committed result is returned rather than falsely reporting a rolled-back business write. Sanitized diagnostics are best effort.
- No marker expires automatically. A crash between database commit and Redis finalization cannot honestly guarantee a corresponding increment without a durable database outbox; this implementation instead keeps reads authoritative until controlled recovery. That preserves publication correctness without another schema change.
- Local/test never use Production credentials or pretend to share process-local authority. Normal local previews read PostgreSQL uncached; injected shared providers exercise cache behavior in tests.

## Validation record — preceding M1 corrections

The preceding correction run executed:

| Check                                                                      | Result                                                                  |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Prisma validation                                                          | Passed                                                                  |
| M1 domain, validation, money, scope and actual Next/PostgreSQL cache suite | 52 passed, including 8 real Next cache tests and PostgreSQL persistence |
| Focused navigation/money unit tests                                        | 11 passed                                                               |
| Production P1 safety/manifest suite                                        | 12 passed                                                               |
| P1 optimized runtime safeguards                                            | 2 passed                                                                |
| A1/A2/Admin dashboard domain regressions                                   | 32 passed                                                               |
| A4 governance regressions                                                  | 20 passed; 1 pre-existing historical Student-ID-prefix failure          |
| Provider-free Admin UI                                                     | 35 passed                                                               |
| Authenticated M1 lifecycle/public/security/responsive Playwright           | 4 passed against the final optimized artifact                           |
| Homepage/navbar/lower-section public regressions                           | 36 passed; 1 intentional mobile-only case skipped on desktop            |
| Optimized build with database/Clerk absent                                 | Passed; zero Marketplace database-read/unavailable events               |
| Typecheck/lint/scoped formatting/diff                                      | Typecheck/lint/scoped formatting/diff passed                            |

The remaining A4 failure is the previously reproduced baseline issue: its historical upgrade expects `MLM-STU-` IDs even though the approved Student-ID migration intentionally converts them to `ST-`. The same failure was reproduced on untouched `51aa904`; the ignored baseline reproduction log remains under the review directory. No unrelated test or authorization was changed to hide it.

Tests preserve strict DTO exclusion, published-only filtering, optimistic revisions, concurrent writes, transaction-time capability revocation, atomic audit rollback, SQL constraints and canonical Course isolation. New tests cover academic-only denial, explicit Marketplace allowance, GOVERNANCE derivation, full 13-capability persistence with invalid arrays rejected, exact INR/JPY/KWD parsing and real stored null/zero values. Actual production-mode Next IncrementalCache tests cover normalized request reuse, bounded tagged lifetime, variant separation, cold/expired failure recovery and publication invalidation; PostgreSQL query hooks prove repeated identical previews need only one findMany/count pair. Test data exists only in disposable schemas; no Development seed is introduced.

The authenticated tests use the owner's existing Clerk Development identity with fresh run-owned sessions, revoked afterward. All role/policy and catalogue fixtures are isolated Test data. Browser checks exercise Admin create/edit/lifecycle, CSRF, anonymous/academic-only/role-revoked denials, opaque references, stale revisions, unsupported methods and mass assignment. Public checks cover empty/unavailable/populated/paginated states, unchanged hero/account UI, mobile focus/keyboard behavior, and WCAG axe/overflow at the required widths.

The final global `npm run format:check` still reports exactly three untouched baseline files: `scripts/production/bootstrap-first-governor.ts`, `scripts/production/intent.ts`, and `tests/production-providers.test.ts`. All task-changed files with a supported formatter are checked separately (69 Prettier files; Prisma validated separately; SQL reviewed and manifest-pinned). These unrelated formatting differences were preserved. The existing source/history/client audit scanned 569 text files, 874 historical blobs and 58 client JavaScript files, with zero known-format findings or private-value matches. `.env.local` remains ignored; candidate values were never printed.

The optimized build with DATABASE_URL and Clerk keys explicitly empty passed after the final cache race fix. Its output contains no Marketplace unavailability event, consistent with `connection()` preventing the reader from running at build time. A normal local optimized build also passed. The final authenticated browser run passed 4/4, and captured updated seventh-domain navigation, human Price input and responsive public cards. The no-JavaScript regression that exposed duplicate Suspense IDs was fixed in production markup; assertions were retained. Deferred-loader race tests prove one and two invalidations cannot revive a stale publication.

## Validation record — Autoscale correction

The completed run uses injected provider commands and two independent production-mode Next IncrementalCache directories. A composition test instantiates two separate UpstashMarketplaceGeneration adapters sharing only the injected Redis-command backend. No fake provider secrets or live Production provider is needed.

| Check                                                                        | Executed result                                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Full Marketplace domain/permission/price/cache/provider/multi-instance suite | 77 passed; 0 failed; 0 skipped                                                                       |
| Shared-generation adapter                                                    | 9 passed (included above)                                                                            |
| Real Next cache/PostgreSQL suite                                             | 8 passed (included above)                                                                            |
| Autoscale/deferred/failure/composition suite                                 | 16 passed (included above)                                                                           |
| A1/A2/Admin dashboard/navigation regressions                                 | 36 passed                                                                                            |
| Existing Production-provider regressions                                     | 12 passed                                                                                            |
| Provider-free Admin UI/accessibility                                         | 35 passed                                                                                            |
| Authenticated Marketplace/public/responsive browser cases                    | 4 passed                                                                                             |
| Public homepage/navbar/no-JavaScript/lower-page regressions                  | 36 passed; 1 intentional skip                                                                        |
| Full typecheck and lint                                                      | Passed                                                                                               |
| Optimized build with DB/Clerk/providers absent                               | Passed; 0 Marketplace dependency-unavailable events                                                  |
| Normal local optimized build                                                 | Passed                                                                                               |
| Scoped formatting and git diff --check                                       | Passed                                                                                               |
| Global formatting                                                            | Only the same 3 untouched baseline files fail                                                        |
| Existing source/history/client audit                                         | 575 text files, 874 history blobs, 58 client JS files; 0 known-format findings/private-value matches |

The deterministic deferred tests cover publish/edit/unpublish/archive across instances, identical-generation reuse, late generation-N fills, successive mutations, post-read generation failure, unknown/missing state, authoritative outage fallback, double-failure unavailable state, successful exact-once finalization, failed transaction zero increments, pending retention after ambiguous errors and recovery without resurrecting old cache. The PostgreSQL cache test uses two separate caches, actual service transactions, query hooks and audit counts: one query pair per instance/generation, six confirmed writes/six increments/six audits, zero enrollments, and failed archived publication adds no increment. No sleeps determine concurrency assertions.

The preceding A4 historical Student-ID test failure and formatting differences in three untouched files remain known baseline issues. No A4/security/auth test was weakened or unrelated file reformatted to hide them. Actual live Upstash Lua execution, permissions and latency remain a future authorized provider verification; no Production endpoint was contacted. This task changes no schema/migration, Admin/public design, price rules, LMS Course relation, lifecycle or audit implementation.

## Shared-state initialization and recovery — future operator work only

These steps are documented but were not executed against Production. The control hash is intentionally not created by a homepage read, API request, build or startup. A missing/recreated key cannot safely declare itself clean while an older transaction might still commit. Until initialized, public previews read PostgreSQL directly and Production Marketplace mutations refuse before database work. This affects no local/test credentials or data.

Before enabling Marketplace writes in an Autoscale rollout:

1. Deploy the coordinated writer code to every serving instance while Marketplace writes remain paused. Drain old versions and all in-flight Marketplace writes; do not mix uncoordinated old writers with an enabled shared cache.
2. In the existing trusted server-only operator environment, use the already approved Upstash configuration. Its permissions must cover the fixed Marketplace hash and the exported Lua scripts. No new provider or secret is required.
3. Confirm quiescence externally. For a genuinely absent key, invoke `initializeAfterQuiescence(null, randomUUID())` on UpstashMarketplaceGeneration. It atomically creates epoch, generation 0 and pending 0 only if absent, without a TTL. Do not invoke initialization as an automatic retry or let it overwrite existing state.
4. Verify a clean shared snapshot, then resume Marketplace writes. Verify publication through separate instances during the later authorized live smoke check.

After an unknown database outcome, an unacknowledged begin/finalize, or an interrupted writer, a pending token can persist. Readers intentionally keep using PostgreSQL even after Upstash connectivity recovers. Never expire/delete pending markers or clear them solely because a timer elapsed. Pause/drain all writers again, read the current valid snapshot, then use `resetAfterQuiescence(expectedEpoch, randomUUID())`. An epoch CAS must match; the reset rotates the epoch, advances the valid generation and clears pending tokens only under that externally verified maintenance quiescence. A malformed state is refused rather than silently repaired; investigate through the existing trusted provider/operator process.

These maintenance methods are server-only and have no HTTP route, UI control or startup hook. New epochs prevent surviving Next cache files from being reused after initialization/recovery. A commit acknowledgment lost after Redis execution can be finalized again without another increment. If a process dies after PostgreSQL commit but before Redis finalization, no cross-database exactly-once claim is made: dirty-state authoritative reads preserve correctness until reconciliation. No new PostgreSQL outbox/schema is introduced.

The implementation now supports multiple independently cached Autoscale instances; it no longer has the earlier single-process correctness limitation. Live Upstash/Lua authority, primary-routing behavior and latency remain unexecuted provider checks because this task forbids Production access. No Production provider state, database, secrets, resources, DNS or deployment was changed.

## Scope left for later phases

Individual offering detail pages, checkout, payments, orders, enrollment creation, entitlement activation, applications/waitlists, public catalogue search/complex filtering, media uploads/storage and related provider integrations remain deferred. The Course association supplies metadata only; purchase or availability does not grant LMS access.

No Production database/provider connection, Production migration, DNS change, infrastructure/identity provisioning, Development fake catalogue, auto-seeding, commit, push, deployment publication or site publication was performed for this work. Local Development migration execution and isolated Test fixtures are disclosed above. Existing production guardrails remain in force; a successful local build does not establish unresolved Production-provider readiness.

## Visual QA and evidence

Twenty current public/Admin screenshots are stored under ignored `docs/reviews/marketplace-m1/`: populated catalogue and homepage at 1672, 1440, 1024, 820, 390 and 320px; empty catalogue at 1440; published Admin editor at 1440, 390 and 320; Admin list at 1440/390; and inherited dark editor at 1440/390. The populated records are disposable Test fixtures, not Development or Production offerings. All tested views have no horizontal document overflow and zero axe WCAG 2 A/AA and 2.1 A/AA violations. Card text clipping is asserted separately. Native Details Coming Soon dialogs, Courses-to-catalogue navigation, and public pagination were exercised.

A real 320px Admin image-preview overflow was fixed using only `min-width: 0; width: 100%` on the new preview; no overflow clipping or unrelated layout change was introduced. Earlier test-only fixes corrected saved-route synchronization, native disabled-fieldset assertions, animated contrast sampling and the distinction between Next development source-map diagnostics and application mutations. Business security assertions were retained.

Existing historical Hero/Ecosystem tests that require the superseded homepage are not presented as passing. The old Ecosystem source remains available; current hero/navbar tests, the selected unchanged lower-page regressions and M1 catalogue tests cover the actual page. The A4 historical-prefix assertion failure is reproduced in `approved-baseline-a4-reproduction.log` in this ignored review directory. No unrelated Student-ID test or production authorization was rewritten to hide it.

The existing known-format source/history/client audit found no credential findings and no private environment value in the generated client JavaScript files. `.env.local` remains ignored. This is a known-format audit, not a claim of exhaustive secret detection. The final read-only local verification found all 15 migrations/checksums complete, no Prisma schema drift, zero MarketplaceOffering rows and zero automatic SCOPED Marketplace grants. Final known-format scan results are recorded in ignored review evidence.
