# Owner-approved legal versioning

The canonical owner-approved contractual documents are `src/content/legal/terms-2026-11-19-v1.ts` and `src/content/legal/privacy-2026-11-19-v1.ts`. Public `/terms` and `/privacy` render these exact sources; wrappers only format them. Effective date: 19 November 2026; version: `2026-11-19-v1`.

The actual Markdown text is pinned by SHA-256 in `tests/legal-policy.test.ts`. Formatting changes to the TypeScript wrapper do not change that digest. A material wording change requires a new version and corresponding versioned sources. Never edit prior accepted contractual text or change a recorded Order version. Keep old sources and their integrity pins. When introducing a later current public policy, preserve publicly addressable historical versions and explicit per-version registry URLs; do not silently make a previous registry entry serve newer text.

`purchaseTerms` in `src/lib/marketplace/commerce/config.ts` registers exactly this approved version with `/terms` and `/privacy`. Operator-selected `MARKETPLACE_PURCHASE_TERMS_VERSION` must explicitly match a registered version. No implicit latest/fallback selection exists. This task does not set environment variables. For later local acceptance only, the intended value is `2026-11-19-v1` in the ignored local environment file, set by the owner/operator. It is not a Production activation instruction.

Checkout acknowledgement remains unchecked initially. Server Order creation requires affirmative acknowledgement and the selected exact version. Persisted financial records retain their accepted version even if environment selection later changes; a conflicting retry cannot rewrite it. Registry entries are frozen, and adding legal content does not enable payments without the other existing Test credentials/gates. Production payment activation remains refused.

No database migration, provider call, tracking, secret configuration or Production publishing is part of this change.
