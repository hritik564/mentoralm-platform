# Marketplace M2 — managed program pages and safe editorial publishing

M2 extends `marketplace-v1` from `bf63880` with reusable `/courses/[slug]` pages. MarketplaceOffering is the sole public visibility authority. The owner-approved editorial follow-up replaces immediate-public page edits with a mutable draft workspace and immutable explicitly published snapshots. Catalogue fields and LMS content are not duplicated.

## Draft and published architecture

`MarketplaceOfferingPage` remains the mutable draft aggregate, keyed by Offering ID. It owns the existing five nullable presentation/SEO settings, UUID draft revision, timestamps and ordered MarketplaceOfferingSection rows. Existing section types, media, limits, structured forms and catalogue fields are unchanged.

One new `MarketplaceOfferingPageVersion` table stores an immutable aggregate snapshot. Its compound primary key is `[pageId, revision]`; fields are `pageId`, UUID `revision`, validated JSONB `snapshotJson` and `publishedAt`. The snapshot envelope is `{schemaVersion: 1, settings, sections}`. Its ordered array includes every section's type, title, subtitle, enabled flag and structured content, including disabled sections. It contains no Offering price/title/category duplicates, LMS records, Admin refs or video/media bytes.

The draft Page gains nullable `publishedRevision`. A composite restrictive FK `[offeringId, publishedRevision]` references Version `[pageId, revision]`, preventing cross-Offering pointers at the database boundary. Version's parent FK is also restrictive. PostgreSQL triggers reject UPDATE, DELETE and TRUNCATE of version history. Superseded snapshots remain identifiable and unchanged.

Public queries select only the Offering's approved public fields and `page.publishedVersion.snapshotJson`; they do not select mutable page settings or draft sections. Snapshot validation precedes filtering enabled/nonempty sections. No published version means basic catalogue-derived content. Invalid snapshots fall back safely and never fall through to draft content.

## Publication and visibility rules

| Offering    | Draft edits      | Explicit page publication             | Public result                                        |
| ----------- | ---------------- | ------------------------------------- | ---------------------------------------------------- |
| DRAFT       | Allowed          | Snapshot may be prepared              | 404                                                  |
| PUBLISHED   | Allowed, private | Replaces the public editorial version | Latest explicit version, or basic catalogue fallback |
| UNPUBLISHED | Allowed, private | Snapshot may be prepared              | 404; previous versions retained                      |
| ARCHIVED    | Read-only        | Rejected                              | 404; history retained                                |

Publishing the Offering never promotes its page draft. Publishing editorial content never makes a private Offering publicly accessible. Unpublishing and republishing an Offering hides and restores the latest explicit editorial version; any newer uncommitted-to-public draft remains private.

## Forward migrations and preservation

The original M2 migration is unchanged:

- `20261118110000_marketplace_page_content`
- SHA-256 `b3bc1a71d7d0cd3e020af897eab08beb6354206bc456c7a6d7f20861cfe67968`

The editorial follow-up adds one forward migration:

- `20261118120000_marketplace_editorial_versions`
- SHA-256 `b475eb9e25ce627c0e13723762f7ff0a397bdcd3bfe75c645e44d0c509ebe2c7`

It creates the version table, nullable pointer, owned FKs, snapshot-envelope checks and append-only guards. It performs no backfill, seed or automatic publication. Populated M2 draft rows survive unchanged; until explicitly published they use the basic public fallback. All M1 and original M2 SQL/checksums remain intact. The pinned release history now has 17 migrations.

`npm run db:migrate:m2:editorial:local` permits only this exact pending migration and a complete matching earlier prefix. It validates local mode, Clerk Development configuration, loopback `mentoralm_dev/public`, exact database identity and manifest checksums before deploying. The earlier task-specific commands reject this unrelated pending migration. Test installs and upgrades use disposable schemas in isolated `mentoralm_test`, whose safety guard rejects the Development target. No Production migration is authorized or performed.

## Structured content and bounds

All page and section inputs are strict objects. Text is trimmed plain text, rejects HTML angle brackets and disallowed control characters, and is rendered as text. Unknown fields, arbitrary JSON shapes, user-supplied positions, IDs, timestamps and publication state are rejected.

| Field/content                                            | Bound                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Page eyebrow / hero headline / hero summary              | 100 / 200 / 1200 characters                                                                      |
| SEO title / description                                  | 160 / 320 characters                                                                             |
| Section title / subtitle                                 | Required nonempty title, 160 / nullable subtitle, 300 characters                                 |
| `OVERVIEW`, `TEXT`                                       | `{body}`, at most 6000 characters                                                                |
| `OUTCOMES`, `ELIGIBILITY`, `WHO_IS_IT_FOR`, `HIGHLIGHTS` | `{items: string[]}`, at most 20 nonempty items of 300 characters                                 |
| `CURRICULUM`                                             | `{modules: [{title, description}]}`, at most 12; title 160, description 1200 characters          |
| `FAQ`                                                    | `{items: [{question, answer}]}`, at most 12; question 240, answer 2000 characters, both nonempty |
| Sections per page                                        | At most 20, including disabled sections                                                          |
| Page API request body                                    | At most 64 KiB of actual bytes                                                                   |

Empty body/arrays may be saved while editing. Public rendering omits empty sections. The bounded request reader reuses existing same-origin/JSON checks with a literal optional 64 KiB bound; all existing callers retain the 16 KiB default. Character bounds and the total byte bound both apply.

## Admin workflow, authorization and atomic publication

The existing Offering editor provides Catalogue and Program page views. Its four editorial states are No published custom content, Draft changes, Published, and Draft changes since last publish. Save Page Draft and Save Section Draft update only the workspace. Section enable/disable and up/down ordering also remain draft-only. Publish Page Changes is explicit and unavailable while editing, busy, archived or unchanged. Error handling and focus behavior remain accessible.

Draft equality uses canonical validated aggregate content, so an equivalent save can rotate the optimistic draft token without falsely creating publishable changes. No page or an empty untouched draft has no changes to publish.

API paths are relative to `/api/admin/marketplace/[offeringRef]`:

| Method/path                                | Behavior                                                              |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `GET /page`                                | Draft settings/sections and editorial state; no write on missing page |
| `POST /page/settings`                      | Save settings draft                                                   |
| `POST /page/sections`                      | Create section draft                                                  |
| `POST /page/sections/[sectionRef]`         | Edit an owned section draft                                           |
| `POST /page/sections/[sectionRef]/enabled` | Change draft visibility                                               |
| `POST /page/reorder`                       | Save exact owned section permutation                                  |
| `POST /page/publish`                       | Explicitly publish the saved aggregate at the submitted UUID revision |

Every operation requires persisted effective ADMIN plus MARKETPLACE_MANAGE. Academic-only roles receive no access. Existing Clerk, same-origin JSON checks, mutation rate limiting, private response headers, opaque ownership refs and request-byte bounds remain. Draft writes and publish recheck authorization inside the existing serializable transaction.

Publish validates the complete saved settings and every section, including disabled sections. It rejects a stale revision, no changes or an archived parent; inserts one immutable version; compare-and-swaps the owned published pointer; and writes AcademicAudit in the same transaction. It publishes the exact saved draft revision without rotating that token. Failed database/audit work leaves the public pointer/version unchanged. Concurrent publishers commit exactly one version; concurrent saves cannot produce mixed snapshots.

New audit actions are MarketplacePageDraftUpdated, MarketplaceSectionDraftCreated, MarketplaceSectionDraftUpdated, MarketplaceSectionDraftReordered, MarketplaceSectionDraftEnabledChanged and MarketplacePagePublished. Historical M2 action mappings remain readable. Details contain bounded context, section counts/types, changed fields and publication revision identifiers. Bodies, FAQ answers and SEO copy are never copied into audit metadata.

## Cache and Autoscale safety

Draft API writes call the transaction service directly: they neither advance public generation nor expire public tags. Only explicit page publish uses the existing withMarketplaceMutation coordinator. Offering mutations retain their approved M1 behavior. No new shared counter, provider or cache system is introduced.

Before a public publish write, the existing Upstash primary protocol must acknowledge its durable pending marker. Failure before work refuses publication. Confirmed database/audit commit advances the shared generation exactly once. Unknown outcomes retain dirty state; readers bypass cache and read PostgreSQL authoritatively. Local tag expiry remains an optional optimization. A late previous-generation fill is discarded/retried and cannot restore old content. DB/audit failure advances no generation.

Program cache projection keys use `program:editorial-v1` under the existing Marketplace tag and finite 300-second cache policy. This namespace change makes pre-editorial cached DTOs containing draft content unreachable immediately, even at an unchanged shared generation. Catalogue keys and the shared epoch/generation/pending protocol are unchanged. React caching still coalesces metadata/render reads after connection(); provider-free builds make no Marketplace DB or shared-state call.

For a future authorized rollout, drain all pre-editorial application readers/writers before enabling draft editing. Old application code still reads mutable draft fields; key versioning protects new readers but cannot change old running code. Use the existing controlled migration/deploy and quiescent shared-state procedures. No rollout or Production shared-state operation was executed here.

## Public presentation, SEO and domain boundaries

Approved program visuals, Marketplace cards, `/courses`, Navbar, homepage hero, account/profile, human price conversion and media allowlist remain unchanged by this correction. Published pages retain the reusable hero, sticky desktop summary, responsive stacking, eight section renderers, native FAQ disclosures and honest availability notices. Disabled and empty published sections are omitted.

Public HTML, RSC DTOs, title, description, Open Graph and Twitter metadata use only the latest explicitly published snapshot or catalogue fallback. Title priority is published SEO title then catalogue title + MentoraLM; description priority is published SEO description, published hero summary, then catalogue short description. Canonical URLs and safe media follow existing rules. Private/unknown offerings return indistinguishable 404/noindex behavior. No invented structured data, ratings or enrollment claims are added.

Marketing curriculum remains distinct from LMS Course/LearningItem/Enrollment/progress/entitlement. Existing image selection, eight allowed raster assets and fallback treatment are reused. No upload provider, checkout, payments, orders, onboarding, entitlement grant, automatic enrollment, waitlist collection or M3 feature is introduced.

## Validation record — editorial correction complete

The guarded local migration reported `applied: [20261118120000_marketplace_editorial_versions]`, total 17 migrations. Read-only verification confirms exact history/checksums, no Prisma drift and zero Development offerings, draft pages, draft sections or published versions. The populated-upgrade test preserves existing M2 settings/sections and creates no publication automatically. All database tests use disposable schemas in separate loopback `mentoralm_test`.

| Check                                                                     | Final result                                                                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run test:m2:domain`                                                  | 80 passed; no skipped tests                                                                                  |
| `npm run test:m1:domain` including Autoscale/generation/cache/permissions | 77 passed                                                                                                    |
| Admin navigation/dashboard/A1/A2 regressions                              | 36 passed                                                                                                    |
| P1 guardrail/manifest tests                                               | 12 passed                                                                                                    |
| P1 provider regressions                                                   | 12 passed                                                                                                    |
| `npm run test:p1:runtime`                                                 | 2 passed                                                                                                     |
| `npm run test:m2`                                                         | 6 passed                                                                                                     |
| `npm run test:m1`                                                         | 4 passed                                                                                                     |
| Existing homepage/navbar/public-section browser selection                 | 36 passed; 1 existing desktop-inapplicable mobile-navigation skip                                            |
| Prisma generation and `npm run db:validate`                               | Passed                                                                                                       |
| `npm run typecheck` and full `npm run lint`                               | Passed                                                                                                       |
| Changed-file Prettier and `git diff --check`                              | Passed                                                                                                       |
| Optimized provider-free and normal local builds                           | Passed; provider-free output contains zero Marketplace dependency-unavailable events                         |
| Known-format source/history/client audit                                  | 645 source files, 996 historical blobs, 58 client JS files; zero known-format findings/private-value matches |

The 80 M2 tests include mutable draft isolation, metadata fallbacks/overrides, exact aggregate publication, all eight section shapes and bounds, wrong-owner references, stale revisions, first-write races, duplicate publication, deterministic publish-versus-save interleavings, transaction-time capability/role revocation, full disabled-section revalidation, immutable-history UPDATE/DELETE/TRUNCATE rejection, SQL envelope/owned-FK checks, failed DB/audit rollback, no-change publication, no generation increment on failure, pre-write coordination failure and exact-once successful generation advancement. Populated M1/M2 upgrades preserve historical business rows and draft content without auto-publication.

Actual production-mode Next IncrementalCache tests use independent caches and distinct Upstash adapters over a controlled primary-protocol test double. They verify no public changes or generation advance from settings/section/order/visibility drafts, explicit publication visible across instances, late old-version reads retrying to the new version, Offering unpublish/republish behavior and legacy pre-editorial cached drafts remaining unreachable at an unchanged generation. Existing M1 Autoscale dirty-state/failure recovery guarantees remain passing. No live Production Upstash connection was made.

Browser tests use the existing owner Clerk Development account, fresh run-created sessions and disposable Test authority/data; cleanup revokes only those sessions. They exercise draft-only saves, basic fallback after Offering publication, explicit rich-page publication, unchanged old public content during subsequent SEO/body/order/visibility edits, aggregate re-publication, stale and academic-only publish rejection, non-Published 404s even with retained snapshots, and no Student/LMS data changes. Six draft sentinels are absent from public HTML/RSC and metadata; title/description/Open Graph/Twitter use only the snapshot or catalogue fallback. No authentication logic was changed.

Public responsive/overflow tests pass at 1672, 1440, 1024, 820, 390 and 320. Sixteen fresh M2 captures are under ignored `docs/reviews/marketplace-m2/`: eight public full/basic/partial captures and eight Admin settings/FAQ/draft/published/light/dark/mobile captures. Representative published and dirty-draft Admin states and desktop/mobile public captures were visually inspected; no clipping or layout defect was found. Representative WCAG A/AA axe checks in the browser suite have zero violations. Approved public program styles/renderers are byte-identical to the pre-correction M2 workspace.

Global `npm run format:check` still reports only three untouched baseline files: `scripts/production/bootstrap-first-governor.ts`, `scripts/production/intent.ts` and `tests/production-providers.test.ts`. They were preserved. All 56 supported changed files pass scoped formatting; SQL is manifest-pinned and Prisma validated separately. The source/client audit is a known-format check, not an exhaustive secret-detection guarantee.

Evidence logs use the `editorial-` prefix in the ignored review directory. See [exact file inventory](MARKETPLACE-M2-FILES.md): 59 cumulative M2 files and 29 editorial-correction files. Branch remains `marketplace-v1`, HEAD `bf63880`; no staging, commit, push, deployment or site publication occurred. No M3 work was started.

## Operational limits and scope

Development intentionally has no real Marketplace offerings or page records; populated tests use isolated fixtures only. Section deletion remains disable-only and the 20-section/content limits are unchanged. Actual live Production Upstash operation and multi-instance infrastructure verification remain a separately authorized task. Existing quiescent initialization/recovery rules remain.

Production database, Upstash state, secrets, deployment, DNS and identity provisioning remain untouched. No commit, push, deployment or site publication. The owner reference `Reference/homepage-hero-approved.png` remains untracked, unread and unchanged. All historical migrations and approved public visual/auth/LMS/deployment files are preserved. See [exact file inventory](MARKETPLACE-M2-FILES.md).
