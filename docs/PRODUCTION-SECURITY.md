# Production security and observability foundation

P1 is local preparation only. No Production credentials, databases, DNS or providers were used. Secrets go through the eventual secret manager; `.env*` (except blank/safe `.env.example`), private operator files, key/certificate files, backup exports, local media and review evidence are ignored. Never commit/deploy `.env.local`. Rotation remains an explicit owner/operator action.

## Request boundaries

Proxy validates Host against approved configuration for application routes and public assets before Clerk/protected routing; approved static assets bypass Clerk afterward. It discards forwarded host for routing and generates a UUID correlation ID, replacing caller-provided internal IDs. Redirects use the canonical trusted origin instead of request/forwarded authority. APIs use Host-derived approved origin for same-origin JSON/multipart protection, retaining content/type/size bounds. Unexpected subdomains/ports, downgrade Origin, arbitrary return URLs and forged role/actor inputs deny. Ingress must preserve a verified public Host, normalize forwarding headers, enforce HTTPS and reject direct/untrusted origin access; the application cannot independently establish the front-end TLS connection when TLS terminates elsewhere.

P1 adds nosniff, SAMEORIGIN framing (preserves same-origin protected PDF iframes), strict-origin-when-cross-origin referrer policy, camera/microphone/geolocation/payment denial and a compatible minimal CSP: base-uri self, object-src none, frame-ancestors self. It does not claim a full script/connect/media CSP. HSTS max-age 86400 requires Production plus explicit `PRODUCTION_HTTPS_CONFIRMED=1`, set only after ingress verification (runtime proxy header after restart, independent of build-time headers); no includeSubDomains/preload. Evaluate longer policy only after all subdomains have valid HTTPS. Public responses omit powered-by. Existing theme preference cookies already use SameSite=Lax and Secure over HTTPS; they carry no authorization. Clerk owns authentication cookie attributes, which require future real-HTTPS inspection.

Full nonce/script/connect/media CSP requires actual Clerk and P2 media/provider origins, representative OAuth/verification/account/PDF/player tests and report-only evaluation. Do not deploy an untested blanket CSP. [Clerk CSP integration guidance](https://clerk.com/docs/guides/secure/best-practices/csp-headers).

## Structured application logging

Closed server events: request, request_error, startup, configuration_invalid, dependency_unavailable. Safe fields: UUID, approved domain/local label, masked route family, severity, safe code, status and bounded duration. Never serialize an exception, headers, request/response bodies, environment, Clerk/database values, URLs/query strings, passwords, tokens, cookies, Student answers, Support text or file contents. API request context uses AsyncLocalStorage; response `X-Request-ID` links proxy and handler records. Proxy timing covers proxy work only; API timing covers the handler. Existing client error boundaries emit fixed safe labels.

Node instrumentation validates startup and records safe captured request-error envelopes without passing exception text. Existing API generic error mapping remains; unhandled wrapper failures return generic 503/no-store. Next.js and eventual ingress/platform logs are independent: configure their retention/access/redaction and audit actual provider logs before Production. Application logging cannot guarantee redaction of all third-party/runtime/platform output. [Next instrumentation reference](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).

Collect JSON stdout/stderr through Replit deployment logs. Optional Better Stack HTTP transport reprojects safe fields, bounds concurrency to four and deadline to two seconds, discards successful response bodies, drops sends on saturation, and cools down 30 seconds on failures. No queue/retry or awaited product dependency exists; external receipt is not guaranteed. Restrict source tokens, choose retention/alerts/access ownership and inspect real platform logs before launch. Restrict log access and preserve external migration/backup/bootstrap change-ticket evidence; structured logs do not replace immutable AcademicAudit.

## Limits and honest launch gates

The async MutationLimiter contract awaits every Admin/Student/LMS write caller. Local/test implementation retains fixed one-minute windows, bounded policy quotas and max 10,000 entries. Production uses the Upstash atomic EVAL/expiry adapter. Missing/unavailable authority rejects writes UNAVAILABLE and readiness remains 503; no local fallback is available. Quota exhaustion returns RATE_LIMITED.

Required distributed policies: Admin and governance/role mutations, bulk, academic operations, uploads, Support, discussions, referrals and communications planning. Scope keys remain server-derived identity plus action policy; do not log/store raw sessions as limiter keys. Implemented keys are stable hashed database identity plus closed policy, counters/TTL are atomic and bounded, and probe/write failures close authorization-sensitive writes. Provider monitoring and live authority/latency tests still require future setup. Edge unauthenticated request/body/health abuse controls also require provider/ingress selection. Clerk handles its own authentication-provider protection.

## Audit and operational security

Effective persisted ADMIN remains mandatory even when policy exists. Fresh transactional checks/revisions/shared governance lock, audit rollback, last-Governor safeguards and Student/Instructor coexistence remain. Immutable audit SQL guards are preserved, including restore/runbook expectations. There is no Production seed, online bootstrap, audit cleanup or HTTP break-glass. SQL migration tools use only guarded deploy/preflight/status; generic unguarded npm migration aliases refuse. Direct manual database tooling is an operator privilege requiring separate change control.

Secret scanning is a bounded local source/history audit, not a guarantee that no unknown credential format exists. P1 records path/category counts and remediation only, never matching values. No automatic rotation. Review complete release/runtime logs and secret-manager grants with the selected provider before traffic.

## Generated infrastructure hostname

Only an explicitly configured REPLIT_BOOTSTRAP_HOST in Production may access GET/HEAD liveness/readiness; root maps to liveness. Business/auth/assets deny. It never enters canonical origin, session-party or redirect allowlists. Unknown generated hosts and forwarded hosts remain untrusted. See PRODUCTION-PROVIDERS.md.
