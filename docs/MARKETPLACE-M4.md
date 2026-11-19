# Marketplace M4 — authoritative commerce

Implemented on `marketplace-v1` over approved M3 `cf61312`. M4 ends at purchased Entitlement. No automatic LMS Enrollment, Batch membership, lesson/progress, certificate or Dashboard redesign. No seed, Production operation, deployment, commit or push is authorized.

## Provider and trust boundary

`src/lib/marketplace/commerce/gateway.ts` owns provider-neutral session, evidence, event and Checkout presentation contracts. `RazorpayGateway` is the initial adapter (`RAZORPAY`); Cashfree is not integrated. Normalized event kinds prevent Razorpay event names from determining generic settlement rules. Provider-specific Checkout data stays in the Razorpay client adapter.

The server uses the fixed Razorpay Orders REST API with secret Basic credentials, integer quote amount, currency, UUID receipt and partial payments disabled. Checkout gets only the public key ID, provider Order ID, amount and currency. No secrets, instrument details, raw payloads, provider errors or browser money enter financial DTOs/audit. Requests reject redirects, use a two-second timeout and bound responses at 256 KiB. Initial adapter supports INR amounts of at least 100 minor units only; unsupported/free/subminimum purchases fail closed, without rounding or granting access.

Razorpay Orders does not document a general idempotency header. PostgreSQL atomically claims one create call per local PaymentAttempt; the persisted UUID is the provider's unique receipt. After an uncertain response/crash, retries recover with the documented receipt-filtered list API instead of blindly creating another provider Order. A crash before the outbound POST can leave UNKNOWN with no provider session; operator investigation is deliberately required rather than risking double charging. Multiple receipt matches fail closed. There is no financial correctness dependency on process memory, browser button disabling or a local mutex.

Official protocol references inspected for implementation:

- [Orders creation](https://razorpay.com/docs/api/orders/create), [receipt-filtered fetch](https://razorpay.com/docs/api/orders/fetch-all), [fetch Order](https://razorpay.com/docs/api/orders/fetch-with-id), [Order payments](https://razorpay.com/docs/api/orders/fetch-payments).
- [Standard Checkout integration and verification](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps).
- [Raw webhook verification and replay](https://razorpay.com/docs/webhooks/validate-test), [disputes](https://razorpay.com/docs/webhooks/disputes).

Browser returns verify HMAC-SHA256 over the **server-stored** Order ID plus returned payment ID using the API secret, then independently fetch provider Order/payments. A valid callback signature, query string, redirect, supplied payment ID or claimed captured webhook type cannot itself settle an Order. Actual provider evidence must match merchant credentials/account, session, receipt, exact amount/currency, captured transaction and unique transaction consumption.

## Additive schema and migrations

Models: `MarketplaceOrder`, `MarketplacePaymentAttempt`, `MarketplacePaymentEvent`, `MarketplaceEntitlement`, `MarketplaceCommerceEvent`. Existing User/Offering/Intent gain inverse relations; Intent gains nullable `redactedAt`. No backfill or automatic permission grants.

Enums: `MarketplaceOrderStatus`, `MarketplacePaymentStatus`, `MarketplacePaymentEventKind`, `MarketplacePaymentEventStatus`, `MarketplaceEntitlementStatus`, `MarketplaceCommerceEventKind`. Existing `AdminPermission` gains only `COMMERCE_VIEW` and `COMMERCE_MANAGE`.

| Migration                             | SHA-256                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `20261119100000_commerce_permissions` | `8e1e52d6a9a5ff81415206a48b002b873ed3d4be82f5a48c00f63086785f9086` |
| `20261119101000_marketplace_commerce` | `696ddf39586e11901a9586ee95af93d9051fdc2295bd6d6aca7dd08dbe94e249` |

All 18 historical SQL files/checksums remain unchanged. `npm run db:migrate:m4:local` validates the exact approved prefix, local mode, Clerk Development and loopback `mentoralm_dev/public` before connecting. Both migrations applied locally; repeat applied none; total history 20. Disposable `mentoralm_test/d4_*` schemas validate clean migration, M3 upgrade and zero drift. Development verification reports zero Orders, attempts, provider events, Entitlements or commerce events. No seed ran.

Database constraints include unique Intent/Order and Order/Attempt, provider/account/session and consumed payment IDs, provider event ID and digest, one open purchase per User/Offering and one ACTIVE Entitlement per User/Offering. Identity/quote and settled transaction bindings are immutable. Deferred triggers verify PAID → captured matching Attempt → matching ACTIVE Entitlement atomically. Financial rows reject deletion/truncation; business audit is append-only. Serializable retries and transaction-scoped purchase locks provide cross-instance correctness.

## Lifecycle and recovery

Orders: `PENDING_PAYMENT → PAYMENT_PROCESSING → PAID`; invalid/ineligible evidence → `REVIEW`; provider refund/reversal → `REFUND_PENDING/REFUNDED`. `CANCELLED/EXPIRED` are explicit terminal availability states. An expired Order with no provider attempt can be expired safely when creating a fresh purchase. Attempted/uncertain commitments block overlapping purchases pending reconciliation.

Attempts: `CREATED → CREATING → PROVIDER_PENDING → AUTHORIZED → CAPTURED`, or uncertain creation `UNKNOWN`, or settled full refund `REFUNDED`. Individual failed bank payments leave the same provider Order retryable with `PAYMENT_FAILED`; they never grant access. Authorized evidence is insufficient. Old snapshots never downgrade captured/refunded state. One PaymentAttempt represents one provider checkout Order, which may contain multiple failed customer payment transactions; only one captured transaction may settle it.

The conservative expiry rule holds late verified captures for review, retaining the captured transaction but granting no access. The adapter does not pretend a payment creation timestamp is its capture time. Closed/unpublished programs cannot start an Order/provider session; valid previously committed payments use their immutable quote. No client-controlled amount/tax line exists.

`POST /api/payments/razorpay/webhook` accepts only bounded JSON raw bytes (64 KiB), verifies exact HMAC bytes using a separate current/optional previous webhook secret, validates account and event ID, and stores normalized metadata plus SHA-256 digest. No Clerk or CSRF gate is appropriate on this provider-authenticated endpoint. Customer/Admin mutation routes retain session, ownership/permission, same-origin body validation and rate limiting.

Durable inbox statuses are RECEIVED/PROCESSED/UNRESOLVED/REJECTED. Event ID rebinding is rejected; identical digests deduplicate even under a different header ID. Duplicate delivery, out-of-order notifications and concurrent webhook/reconciliation converge on one paid transition/grant/audit. Valid unrelated events are acknowledged with minimal durable state; unresolved references remain recoverable. Internal/database/provider failures return safe retryable 503, leaving received work for retry. No full webhook payload is persisted.

Customer Verify and signed return call the same server reconciliation. `reconcilePendingCommerce` supports bounded operator/scheduled recovery (up to 100 events plus 100 attempts); counts only, no PII. `npm run dev:marketplace-reconcile` is local-only, requires an existing persisted financial operator and configured sandbox gateway. No production scheduler or live reconciliation was enabled.

## Entitlement, refunds and audit

Verified settlement atomically records PAID, captured payment identity, ACTIVE Entitlement and PaymentConfirmed/EntitlementGranted audit. Unique ACTIVE User/Offering protects repeated callbacks/reconciliation; active ownership blocks new intents/Orders and program CTA becomes Go to Dashboard. Revocation/refund retains financial history. Full provider refunds set REFUNDED; partial refunds revoke access and hold REFUND_PENDING. Verified disputes revoke active access and remain sticky even under later captured snapshots or dispute-won notifications. Full refund after a dispute resolves to REFUNDED; no automatic restoration. Refund initiation, financial overrides and a Mark as Paid action do not exist.

Commerce events contain bounded kinds/codes, actor linkage, Intent/Order linkage and timestamps; no onboarding answers, name/email, phone, card details, secrets or raw provider payload. Separate commerce audit avoids leaking financial information through catalogue/academic audit permissions. Audit failure rolls back settlement and grant together. Existing financial state is never deleted for cleanup.

## Financial permissions and surfaces

`MARKETPLACE_MANAGE` remains catalogue/editorial only; `COMMERCE_VIEW` reads Orders/minimal customer name/email; `COMMERCE_MANAGE` plus VIEW reconciles provider evidence. Neither academic nor catalogue editors inherit finance permissions. Existing GOVERNANCE semantics include new capabilities, while scoped Admins receive no automatic grants. Authorization is rechecked after directory lookup and inside the governed settlement transaction; mid-flight revocation denies settlement.

Existing Admin Marketplace gains `/admin/marketplace/orders` and opaque-ref detail, paginated 20 rows and bounded 50-event history. No sensitive provider IDs or onboarding content are projected. API reconciliation is protected separately; no fake refund/manual-paid UI. Private customer Order pages show ready/pending/verifying/failed/paid/review/refunded states from server DTOs only, preserve the existing navbar/account system and provide Support/checkout/Dashboard paths.

## Abuse and retention

Anonymous starts use server-issued random HttpOnly proof plus domain-separated signed sidecar; persisted valid M3 anonymous proofs are preserved. A client-chosen arbitrary token cannot select its rate identity. Per-browser start 20/minute precedes the high global emergency breaker (12,000/minute); authenticated payment mutations use 20/minute and onboarding retains its own policy. Production continues using existing distributed Upstash limiting, with no spoofable IP header trust. Clearing browser cookies still permits fresh identities; distributed bot/device defenses and operational threshold tuning remain future infrastructure work, not a claimed complete bot solution.

PII minimization policy: anonymous unclaimed onboarding becomes eligible seven days **after Intent expiry**; authenticated abandoned/expired/cancelled prepayment and confirmed-failed unpaid onboarding become eligible 30 days **after expiry**. Cleanup dry-runs by default, is bounded to 100 (default 50), idempotent, and requires persisted COMMERCE_MANAGE. It deletes onboarding answers and irreversibly retires proof/intent, while keeping reference/status/quote/audit and all financial records. It skips paid/refunded/review, any Entitlement and uncertain/creating/authorized/captured provider attempts. No production cron was added.

Local commands use `MARKETPLACE_OPERATOR_CLERK_ID` from ignored environment and existing roles; they create no users/grants:

```sh
npm run dev:marketplace-cleanup
npm run dev:marketplace-cleanup -- --apply
npm run dev:marketplace-reconcile
```

Paid/accounting/payment/Entitlement records and their linked onboarding currently remain held pending owner/legal retention policy. These operational 7/30-day windows are minimization boundaries, not invented legal retention periods. No paid data cleanup, anonymization of accounting identities or refund initiation is authorized in M4.

## Configuration and limitations

Only blank server environment names are documented: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_ACCOUNT_ID, RAZORPAY_WEBHOOK_SECRET, optional RAZORPAY_PREVIOUS_WEBHOOK_SECRET and MARKETPLACE_PURCHASE_TERMS_VERSION. No credentials were added. Runtime accepts only test-mode gateway keys outside Production. Production payment activation explicitly fails closed and needs a later approved operational/configuration review.

Existing terms/privacy pages are placeholders; the approved purchase-policy registry is empty. Checkout remains intentionally unavailable until owner-approved published purchase terms/privacy and versioned registry entries are supplied, plus sandbox credentials. Adding environment text alone cannot activate unapproved legal content. Tests inject synthetic policy/provider data only into isolated fixtures, never runtime routes. The Razorpay Checkout script loads only on an enabled payment interaction. No sandbox/live API, checkout charge, webhook endpoint registration, Production resource, DNS or credential rotation occurred. Browser validation verifies honest unavailable checkout plus domain-created injected-provider payment states, not a live gateway charge.

M5 must consume Entitlement to provision delivery safely and independently enforce LMS entitlement, Enrollment and course/batch authorization. M4 does not grant LMS access, create course progress, certificates or cohort membership. Tax/invoicing, production activation, real sandbox acceptance, approved legal content, refund initiation, automatic dispute restoration, bank settlement accounting and production scheduling remain deferred.

## Validation evidence

Logs, screenshot manifest, migration output, source/client audit and exact changed-file inventory are under ignored `docs/reviews/marketplace-m4/`. The completion report records final executed results. Captures mask real account/customer information. No owner-provided reference image is read or modified for M4.

| Executed check                                               | Final result                                                                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prisma validate/generate                                     | Pass                                                                                                                                                                                       |
| Clean isolated PostgreSQL and exact M3 upgrade, schema drift | Pass (included in M4 tests)                                                                                                                                                                |
| M4 domain/security/integrity                                 | 65 passed, zero skipped                                                                                                                                                                    |
| M1 / M2 / M3 domain                                          | 77 / 80 / 55 passed                                                                                                                                                                        |
| Shared Admin navigation/dashboard/A1/A2/A4                   | 57 passed                                                                                                                                                                                  |
| P1 / providers / runtime                                     | 12 / 12 / 2 passed                                                                                                                                                                         |
| M4 authenticated browser                                     | 1 passed; provider unavailable is intentional                                                                                                                                              |
| M1 / M2 / M3 browser                                         | 4 / 6 / 1 passed                                                                                                                                                                           |
| Homepage/navbar browser                                      | 36 passed, one expected mobile-only case skipped in the desktop project                                                                                                                    |
| Representative M4 axe                                        | Zero WCAG A/AA violations in pending/paid/review at 1440/390, pending at 320, checkout at 320/1440, Admin list/detail and dark/mobile list                                                 |
| Visual captures                                              | 19 masked captures; desktop 1440, mobile 390, narrow 320; Admin light/dark                                                                                                                 |
| Provider-free / final normal optimized build                 | Pass; provider-free build has zero dependency-unavailable events                                                                                                                           |
| Typecheck / lint / changed-file format / diff whitespace     | Pass                                                                                                                                                                                       |
| Repository-wide format check                                 | Three pre-existing warnings in untouched scripts/production/bootstrap-first-governor.ts, scripts/production/intent.ts, tests/production-providers.test.ts; no unrelated formatting changes |
| Source/history/client artifact audit                         | Zero signature findings and zero private environment value matches                                                                                                                         |

Historical A4 upgrade regression was scoped to applying A4 alone, preserving its exact unchanged Student snapshot assertion: the previous test unintentionally applied later approved P1 Student-ID normalization as well. Manifest count and Marketplace navigation expectations now reflect 20 migrations and the separately authorized commerce destination. No security assertions were removed.
