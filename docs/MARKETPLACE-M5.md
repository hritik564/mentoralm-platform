# Marketplace M5 — purchased-program delivery

Implemented on `marketplace-v1` over approved M4 `8c475e6`. M5 consumes commercial ownership; it does not replace it. No new gateway, tax/invoice/coupon/subscription, certificates-on-purchase, marketing integration or complex cohort selection. No Production connection, seed, deployment, commit or push.

## Authority and financial independence

Verified captured payment → ACTIVE MarketplaceEntitlement → durable MarketplaceDelivery → separately authorized provisioning → existing LMS Enrollment. M4 settlement atomically writes the small PENDING/NOT_REQUIRED outbox and its creation audit; it performs no LMS provisioning, identity changes, prerequisite validation or provider calls for delivery. Later learning errors commit FAILED/REVIEW independently and never roll back PAID, remove an Entitlement or imply payment failure.

The commercial and learning authorities remain separate. An existing Clerk session maps to the same persisted User. LMS requires persisted learner identity, a normal Student ID, independent business authorization or an ACTIVE initialized Marketplace LMS grant, published Course and a usable Enrollment. Explicit administrative DISABLED always wins. Primary persona/privileged roles are preserved. No override boolean or Batch setting is changed, and no Batch is assigned. See the approved learner extension below.

## Additive schema

`MarketplaceDelivery` has internal ID, opaque unique publicRef, unique Entitlement FK, EXTERNAL/LMS type, status, nullable Course/Enrollment references, unique nullable createdEnrollmentId, NONE/CREATED/REUSED provenance, attemptCount, lastAttemptAt, safe lastErrorCode, provisionedAt/revokedAt, UUID revision and timestamps. All references restrict deletion/update; indexes cover status/last-attempt, Enrollment and Course. No bytes, secrets, full exceptions or onboarding PII.

Three delivery enums: MarketplaceDeliveryType; MarketplaceDeliveryStatus (NOT_REQUIRED, PENDING, PROVISIONING, ACTIVE, FAILED, REVOKE_PENDING, REVOKED, REVIEW); MarketplaceEnrollmentProvenance. Existing commerce audit enum gains seven delivery events. Existing AdminPermission gains DELIVERY_MANAGE; valid unique permission-set capacity becomes 16, without scoped grants/backfill. Existing Course/Enrollment/Entitlement gain inverse relations only; no new Student identity, Course or Enrollment system.

Database checks enforce ACTIVE's references/timestamps, explicit non-null CREATED provenance, matching Entitlement-user/Enrollment-course, immutable binding/provenance, monotonically retained attempt count and terminal revocation. Delivery rows cannot be deleted/truncated. Referenced Enrollment identity cannot be rebound; FK restrictions preserve learning history.

| Forward-only local migration                    | SHA-256                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `20261119110000_delivery_permission`            | `3b32ac5b089c93b93a89cfd940f875b61e93e2705572c90dfa86b8f1dcb9a91a` |
| `20261119111000_marketplace_delivery`           | `3a6d7a567ac941cb24598faaec2564272c48826ce455f3e3e37a3ddf32b9eb72` |
| `20261119112000_delivery_provenance_constraint` | 5108e0264dd7c4fed5fe370ddad8182c1feeb9d7938e895b2c0cfed9df5b8b18   |

The first two were applied to guarded local Development, then final review identified PostgreSQL CHECK's acceptance of UNKNOWN for a null creator FK. The third explicitly closes that null case. Applied migration SQL/checksums were preserved; no reset or rewrite. All 20 M4-and-earlier migrations remain unchanged. Final release history 23; clean Test and populated M4 upgrade have zero Prisma drift. Migration creates no business records or fake enrollments/entitlements.

`npm run db:migrate:m5:local` permits only the exact three approved pending names after the pinned baseline. It requires local mode, Development identity configuration, loopback mentoralm_dev/public and valid release history before connecting. Production migration machinery was not executed.

## Enrollment provenance and immediate revocation

The existing Enrollment has a unique User/Course pair and learning statuses ENROLLED/IN_PROGRESS/COMPLETED; it has no inactive/revoked status. Deleting it would destroy provenance and can affect academic history. M5 therefore preserves that record and introduces a shared server-side access predicate:

- Enrollment with no Marketplace creator remains an independent learning grant.
- Marketplace-created Enrollment needs at least one ACTIVE Delivery referencing it whose Entitlement is ACTIVE.
- Persisted learner identity, effective business LMS authorization and published-content checks remain mandatory.

The predicate is applied to LMS list/structure/player, completion/assessment/assignment/discussion/certificate access through the existing Course guard, attendance Course scope, Dashboard enrolled courses and course/program-scoped resources. Revoked commercial grants stop authorizing immediately, including before a worker processes REVOKE_PENDING. Financial revocation can never be bypassed by a stale ACTIVE Delivery or a visible button.

Provisioning records CREATED plus a unique creator FK when it inserts Enrollment; otherwise REUSED references the existing row and preserves its status, timestamps and progress. A reused independent Enrollment survives Marketplace refund. If two offerings map to the same Course, one creates and the other reuses the single Enrollment; either active commercial Delivery can authorize it. Revoking one never removes the other's valid access. Revoking all removes future Marketplace access without deleting academic history. A later purchase can safely reuse that preserved learning record.

Legacy Admin removal of an Enrollment referenced by Delivery now fails with CONFLICT instead of deleting financial provenance. Existing staff can disable LMS through the approved Student/Batch access controls; Marketplace grant changes remain at the commercial boundary. M5 adds no generic Grant Access, Mark Active or Create Enrollment button.

## Provisioning, retry and reconciliation

`MarketplaceDeliveryService` is the canonical service. It first commits a PROVISIONING lease with UUID revision, attempt count/time and audit, then works in a separate serializable transaction. A stale worker must still own the same revision before binding Enrollment. Rechecking commercial status defeats refund-vs-provision races. PostgreSQL purchase locks and a User/Course lock coordinate separate offerings/instances; existing Enrollment uniqueness and bounded serialization/deadlock retries remain final safeguards.

Transient failure records only PROVISIONING_UNAVAILABLE and FAILED. Automatic retry waits five minutes and stops after three attempts. A PROVISIONING lease becomes recoverable after ten minutes; repeated stale leases reach REVIEW/RETRY_LIMIT. REVIEW is never automatically retried. Authorized explicit Admin retry runs the same rules and revalidates prerequisites; it cannot force ACTIVE. In-flight Admin permission revocation denies settlement/provisioning. Failed audit rolls back the learning operation while leaving financial ownership intact.

Dashboard root and `/dashboard/programs` perform a bounded own-user reconciliation (maximum 5). A scheduled/operator-compatible service scans at most 100 candidate Entitlements for missing Delivery, PENDING, stale PROVISIONING, retryable FAILED and revoked grants awaiting reconciliation. No always-on worker or Production cron is required/installed. Customer API reads stay read-only and private. The local operator command:

```sh
npm run dev:marketplace-delivery
```

uses the existing MARKETPLACE_OPERATOR_CLERK_ID and local safety guards, requires persisted COMMERCE_VIEW plus DELIVERY_MANAGE, creates no roles/users, accepts no arbitrary command payload and reports counts without PII.

## Configuration and identity

Delivery type and an available Course target are pinned when the delivery is created. A catalogue edit cannot silently move an already purchased learner to another Course or turn a non-LMS purchase into a learning grant. If the initial LMS target is absent, an authorized explicit retry may use the now-configured Offering Course; bound Enrollment/Course/provenance cannot be rewritten. Existing ACTIVE Entitlements missing Delivery are initialized lazily from current configuration during reconciliation.

A valid published Course needs no Batch for ordinary learning. Courses with an attendance completion requirement need an applicable active membership; live-session/recording features retain their own exact Batch checks. Marketplace cohortStartsAt is not a Batch mapping. No membership is guessed or created. Missing/unpublished Course, missing applicable Batch, unsupported identity or denied LMS entitlement produce safe REVIEW categories and keep commercial ownership intact.

Existing Student IDs come from the approved database issuance path. Ordinary STUDENT purchasers reuse their identity/ID. ADMIN/INSTRUCTOR purchasers receive a separate MarketplaceLearnerIdentity when needed; the existing PostgreSQL issuer and sequence issue an ID without changing persona, role assignments or Clerk. StudentProfile is optional and neither created nor overwritten by delivery. Valid paid LMS purchases supply a provenance-aware business access source rather than entering ordinary identity/access review.

To keep the requested existing Support path usable for those purchasers, owner-scoped ticket operations were extracted into one CustomerSupportRepository. Existing Student methods delegate to it. Persisted Marketplace purchasers of any persona may use their own Support tickets, including after a refund; non-purchasing non-Students remain denied. Other Student profile/resource/referral/LMS role boundaries remain unchanged. Customer messages retain the existing customer-side STUDENT actor category, never STAFF authority. CSRF, strict input, bounded history, reply lifecycle, rate limit and ownership checks are preserved.

## Customer and Admin surfaces

The existing Dashboard gains My Programs in its native sidebar and root overview, plus `/dashboard/programs`. Only the current User's ACTIVE Entitlements populate owned cards, ordered by grantedAt descending with ID tie-break, 20/page. A joined projection plus one business-entitlement check avoids per-card queries. It returns no provider/webhook/payment attempt/onboarding/Student ID/Batch data and never enters public Marketplace caches.

Cards show immutable purchased title, approved image/fallback, purchase date and meaningful text:

- ACTIVE and currently authorized: Continue Learning via existing domain-aware LMS destination.
- PENDING/PROVISIONING/missing Delivery: Preparing your access, confirmed purchase and Support.
- FAILED/REVIEW or later unavailable LMS/Course: Access needs attention, confirmed purchase and Support.
- EXTERNAL/NOT_REQUIRED: Program purchased, real program/purchase-details links, no fake learning experience.

Refunded/revoked Entitlements leave the owned list; preserved Order pages explain refund/reversal. Signed-in program CTA links owners to My Programs; non-owner/signed-out visitors retain Enroll Now. Repeat-purchase/payment-attempt protection from M4 is unchanged. Learning routes independently authorize every launch.

Existing Admin Marketplace Order detail adds Delivery status, linked Course title, created/reused provenance, attempt count, safe error category and timestamps. COMMERCE_VIEW reads; COMMERCE_VIEW+DELIVERY_MANAGE retries. COMMERCE_MANAGE, MARKETPLACE_MANAGE and academic authority alone do not mutate delivery. New scoped capabilities are not automatically granted. Existing GOVERNANCE continues to resolve the full schema-backed permission set under its established semantics.

## Audit and limits

MarketplaceDeliveryCreated, MarketplaceDeliveryProvisioningStarted, MarketplaceDeliveryProvisioned, MarketplaceDeliveryProvisioningFailed, MarketplaceDeliveryReusedEnrollment, MarketplaceDeliveryRevocationStarted and MarketplaceDeliveryRevoked use the existing private append-only commerce journal. They link the existing Order/Intent and trusted Admin actor when applicable; bounded failure codes and immutable Delivery provenance provide investigation context. No raw exceptions, phone, goals, payment credentials or full provider payloads.

No real/sandbox Razorpay payment occurred. Injected provider transport and isolated Test fixtures exercise commerce-to-delivery; real Clerk Development authentication uses only the existing owner account and revokes run-created sessions. Local Development is not seeded with fake purchases. Checkout launch dependencies from M4 remain: approved legal registry, sandbox credentials/acceptance and later explicitly approved Production activation. A valid ACTIVE commercially backed LMS Delivery now supplies account-level business authorization; authentication or browser payment callbacks alone never do. Explicit administrative denial and required Course/Batch prerequisites remain enforced.

Other launch work: operational scheduling/monitoring and legal retention decisions, Course content/publication, deterministic Batch mapping where required, and separate approval for any production rollout. No unrelated LMS/Admin redesign or subsequent phase was started.

## Validation

Exact final results, migration outputs, source/client audit, scoped file inventory and masked capture manifest are recorded under ignored `docs/reviews/marketplace-m5/`. Domain tests cover real PostgreSQL concurrency, shared-Course provenance, stale leases, refund timing, independent access, audit rollback, identity/permission revocation, Support IDOR and clean/populated upgrades. Existing historical LMS upgrade assertions now explicitly account for P1's approved Student-ID prefix normalization while preserving the exact year/sequence and all history assertions.

Before any future authorized production rollout, drain/retire all pre-M5 Website/LMS/Student authorizers before the first Marketplace-owned Enrollment is provisioned. Older readers do not know the commercial provenance predicate. Use a quiescent cutover (or an explicitly designed equivalent) rather than serving mixed old/new authorization code against newly provisioned access. No such rollout or activation was performed here.

| Executed validation                                    | Final result                                                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma validate/generate                               | Pass                                                                                                                                                    |
| M5 domain/security/integrity and populated M4 upgrade  | 32 passed, zero skipped; no schema drift                                                                                                                |
| M4 / M3 / M2 / M1 domain                               | 65 / 55 / 80 / 77 passed                                                                                                                                |
| Existing D4 and L1–L4 domain                           | 62 passed                                                                                                                                               |
| Shared Admin navigation/dashboard/A1/A2/A3/A4          | 88 passed                                                                                                                                               |
| P1 / provider / runtime guardrails                     | 12 / 12 / 2 passed                                                                                                                                      |
| M5 authenticated browser                               | 1 passed                                                                                                                                                |
| M4 / M3 / M2 / M1 browser                              | 1 / 1 / 6 / 4 passed                                                                                                                                    |
| M5 visual/axe checks                                   | 11 masked captures and 11 representative WCAG A/AA scans; zero violations; 1440/390/320 layouts without document overflow                               |
| Provider-free and final normal optimized builds        | Pass; zero dependency-unavailable events during provider-free build                                                                                     |
| Typecheck / lint / scoped formatting / diff whitespace | Pass                                                                                                                                                    |
| Repository-wide formatting                             | Three unchanged pre-existing warnings: scripts/production/bootstrap-first-governor.ts, scripts/production/intent.ts, tests/production-providers.test.ts |
| Source/history/client audit                            | 728 source files, 1153 historical blobs, 68 client JavaScript files: zero signature findings; zero private environment matches                          |
| Local Development verification                         | 23 pinned migrations, zero drift, zero Orders/attempts/provider events/Entitlements/commerce events/Deliveries; no seed                                 |

M1's final browser pass uses the normal build expected by its existing relative-home-link assertion; the initial site-origin-pinned build changed that legitimate link representation and was not used to weaken the assertion. The lesson-history fixture uses explicit equal timestamps to satisfy the existing database chronology constraint deterministically. The injected provider fixture now retains transaction identity per session across multiple purchases. These test corrections preserve the original assertions and production authentication behavior.

## Approved learner capability correction (final M5)

The owner approved automatic learner provisioning alongside the existing persona. MarketplaceLearnerIdentity is retained identity/provenance only, keyed uniquely by User and linked uniquely to its originating Delivery. Its presence never authorizes access. Ordinary primary STUDENT already has a canonical Student ID and needs no new identity row. Non-Student purchasers gain the additional identity only within an ownership-checked, valid-Course Delivery transaction; no STUDENT role assignment, persona conversion, Clerk metadata or optional StudentProfile mutation occurs.

Delivery now records learnerIdentityProvenance and lmsAccessProvenance using the existing NONE/CREATED/REUSED enum. Each valid purchase contributes its own grant/reference. CREATED means Marketplace supplied the prerequisite; REUSED records independently existing access/identity. Public effective entitlement requires learner identity plus non-null Student ID plus independent override/Batch authority OR ACTIVE Entitlement with ACTIVE LMS Delivery and initialized account provenance. An explicit DISABLED excludes both paths. Identity alone, PENDING/PROVISIONING, external offerings and revoked grants authorize nothing.

Canonical provisioning checks commercial ownership, lease revision, published Course and applicable learning/Batch prerequisites directly while PROVISIONING. It serializes by persisted User, ensures learner identity and invokes the unchanged Student-ID sequence/format/immutability mechanism, records safe provenance/audit, creates/reuses Course Enrollment, then commits ACTIVE atomically. It does not call the public ACTIVE-only gate to bootstrap itself. Failure rolls back learner/grant/Enrollment/audit changes without affecting PAID or ACTIVE financial ownership.

Account authorization is derived from current commercial/independent authority, never an irreversible access boolean. One refund cannot disable another paid program or independent access. Final commercial revocation stops Marketplace-only authorization immediately while retaining learner identity, Student ID, optional profile and academic/financial history. Existing Course Enrollment CREATED/REUSED rules remain unchanged. Existing REVIEW records still require the existing authorized Admin retry; no automatic REVIEW bypass was added.

LMS repositories now use fresh persisted learner/business predicates instead of exclusive primary-persona constructor checks. Staff without legitimate learner authorization remain denied. Admin auth/governance is unchanged. A narrow LMS profile boundary reuses the canonical optional education-field validator/store and exact owner; unrelated Student APIs remain primary-Student-only. Profile reads are side-effect-free; profile writes are user initiated, same-origin, rate limited and strictly validated. Recording/discussion/academic/media/publication and exact Batch gates remain authoritative. Current role-aware Batch membership remains primary-Student-only: Marketplace does not convert staff personas or invent membership for attendance-dependent delivery.

One further additive migration, `20261119113000_marketplace_learner_capability`, extends history 23→24. SHA-256: `2587f940dd26daabcd7e9c8047890a7521ad0f95434500895239018be47ca383`. The prior 23 SQL files/checksums are unchanged. Generated SQL was inspected before application: identity table, two default-NONE provenance columns, audit values, integrity triggers and extension of the existing issuer eligibility condition only. No existing persona/ID/profile/Enrollment/Marketplace history rewrite, backfill or seed. Local command: `npm run db:migrate:m5:learner:local`; it refuses any pending migration other than this one after the approved 23. Development now has 24 pinned migrations, zero drift and all pre-migration business records unchanged; repeat applies none.

New bounded events: MarketplaceLearnerProvisioned, MarketplaceLmsAccessGranted, MarketplaceLmsAccessReused. Admin Order detail shows learner identity Existing/Marketplace provisioned and LMS account access Existing/Marketplace granted alongside existing Enrollment provenance. No new manual access bypass or UI redesign.

The validation table above records the initial approved M5 checkpoint. Final learner-extension execution/results and the updated complete file inventory are in ignored `docs/reviews/marketplace-m5/COMPLETION.md` and `learner-follow-up/`; they supersede initial identity limitations and counts. Real sandbox payment acceptance, approved legal registry, operational reconciliation and future authorized rollout remain launch gates. No M6/Production/commit/push/deployment.
