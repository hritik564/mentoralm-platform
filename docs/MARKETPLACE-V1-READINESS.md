# Marketplace V1 future rollout checklist

M6 prepares an engineering candidate. Every unchecked item below is future operator/owner work; none was performed by M6. Real Razorpay Test Mode acceptance remains separate. Current Production payment activation is hard-disabled in code.

- [ ] Approve the exact release, owner/operator and change window; keep the baseline/candidate hashes and complete M6 test/capture/scan evidence.
- [ ] Verify a recent restorable backup, restore rehearsal and accounting/provider reconciliation plan.
- [ ] Verify the original 24 migration names/checksums against the [pinned manifest](../src/lib/production/migrations.ts) plus the single M6 activation guard; final count **25**. Refuse drift/incomplete/unknown ledger entries.
- [ ] Confirm expected database/schema/roles/TLS, grants, pool limits, migration credentials and lock/timeout capacity. Never use runtime startup for migrations or seeds.
- [ ] Enforce cross-surface quiescence: drain Website, Admin, webhook, scheduler, LMS, Student APIs and Dashboard versions that lack M1 shared generation, immutable editorial publication, M5 commercial provenance or M6 canonical claim/terminal-intent reuse.
- [ ] Apply only the separately authorized forward migration procedure; verify ledger/checksums/schema/trigger behavior after application. No destructive rollback/backfill.
- [ ] Deploy one coherent compatible candidate only after explicit authorization. Verify Host/TLS/Clerk Production cross-domain session/sign-in/logout/redirect behavior.
- [ ] Under externally confirmed quiescence, initialize genuinely absent M1 shared Upstash state or use observed-epoch recovery. Verify primary routing/Lua, pending/epoch behavior and fail-closed mutation limiting. Never reset around live writers.
- [ ] Obtain owner-approved published purchase terms/privacy and immutable registry/version entries. Environment text alone is insufficient; do not invent legal language.
- [ ] Provide approved Razorpay Test Mode credentials privately and complete the separate external acceptance: Checkout dismissal/failure/success, server capture, webhook raw signatures/replay/rotation, unknown outcome, refunds and real merchant limits.
- [ ] Record Production merchant/key/webhook secret ownership in the approved secret manager only, plus bounded previous-secret rotation/removal plan. Do not add NEXT_PUBLIC secrets.
- [ ] Separately approve and implement Production payment activation: current code intentionally refuses it and has no enabling environment flag.
- [ ] Register/verify the future webhook endpoint and required events, delivery retries/alerts and bounded reconciliation operator. Do not rely on browser return for settlement.
- [ ] Verify actual published Course/Section/item, independent versus Marketplace account authorization, explicit DISABLED precedence, Course Enrollment provenance and required Batch/attendance configuration.
- [ ] Verify free/subminimum/non-INR/TBA offerings fail honestly for online acquisition; no fake zero-price settlement or conversion.
- [ ] Approve delivery/payment reconciliation schedules and staff capabilities, cooldown/stale-lease alerts, backlog review and dry-run retention scheduling. No Production scheduler exists from M6.
- [ ] Establish safe Replit/Better Stack retention/access/alerts; verify redaction from real platform/provider logs. Optional observability is not financial/authorization authority.
- [ ] Smoke public catalogue/program SEO, signed-out/private denial, anonymous/account continuity, owned Dashboard/Continue Learning, staff persona preservation, Admin permission boundaries and refund/history behavior.
- [ ] Confirm fail-closed purchase disable/incident operations and a compatible code rollback candidate; never revert to pre-provenance readers against new learning grants.
- [ ] Obtain explicit final owner approval before enabling purchases or performing any Production operation.

See [architecture and failure/rollback runbook](MARKETPLACE-V1-RUNBOOK.md). P2 storage/video, invoices/tax, subscriptions/coupons and other product phases remain outside Marketplace V1 M6.
