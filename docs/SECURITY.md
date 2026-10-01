# Security principles and trust boundaries

These requirements apply when relevant functionality is implemented. W1/W2 implements public presentation only, with no authentication, authorization service, data collection, or protected resources.

## Trust boundaries

| Boundary                                    | Required treatment                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Browser or other client → backend           | Treat requests and identifiers as untrusted; validate input, authenticate protected requests, and authorize actions on the server |
| Authenticated identity → protected resource | Verify ownership or permission for every resource; login alone is insufficient                                                    |
| Public website → private platform data      | Expose only intentionally public data through approved contracts                                                                  |
| Backend → database or storage               | Enforce intended access and relationships; do not treat shared infrastructure as unrestricted access                              |
| Admin interface → sensitive mutation        | Check backend permissions and produce audit events                                                                                |
| External input/integrations → platform      | Validate input at the boundary; design integration-specific controls when selected                                                |

## Authorization and student isolation

Client-side hiding, route guards, and disabled buttons are usability measures, never authorization. Prevent cross-student access and IDOR even when a caller changes a URL, request body, or resource identifier. Protected reads, writes, downloads, and learning access must verify applicable ownership or permissions on the server.

Enrollment controls learning access under an explicitly designed policy. Unified identity across surfaces does not grant access to every course, record, or admin action. Test denied as well as allowed actions, including attempts to access another student's resources.

## Secrets and input

Never hardcode production credentials, commit secrets, or expose secrets in client bundles. Keep environment-specific secrets in an approved mechanism once infrastructure is selected. Validate untrusted input at trust boundaries. API errors should be structured and avoid leaking internal implementation details or sensitive data.

## Administration and integrity

Backend permissions protect admin actions. Sensitive mutations must produce audit events when implemented; define event content, access, and retention during design. Roles should evolve toward granular permissions. Preserve assessment history and plan safe published-content versioning.

Identity provider, session design, privacy/retention requirements, tenant model, and audit infrastructure remain unresolved. This document does not select them. See [Decisions](DECISIONS.md).

## Public frontend boundary

The current homepage uses local editorial content and assets. Native dialogs communicate future availability; they do not submit information or simulate backend success. The only form uses `method="dialog"` to close a dialog locally. No secrets or personal records are needed. `NEXT_PUBLIC_SITE_URL` is explicitly public configuration and is validated as an origin before canonical metadata is emitted. No external fonts, third-party analytics, tracking scripts, or remote image hosts are used. Production security headers and privacy policy must be designed with the eventual hosting and integrations before launch.

## D1 identity boundary

Clerk now owns authentication, credentials, verification and recovery. The secret stays server-only; only the publishable key enters the browser. The proxy verifies the provider session before Dashboard requests; each server page/layout also requires the matching current provider user. Client hooks control presentation only. Missing keys deny Dashboard access. No local credential/session fallback, user-id parameter authorization, database, ownership assumptions or Admin privileges are added.

Post-login redirects are constrained to six exact internal Dashboard routes. Logout uses Clerk session invalidation and returns to `/`. Provider forms supply field validation and recovery; application-level logout failures show a generic retry message. Future protected business resources must add ownership/permission checks at their data boundary.

Focused tests use owner-provided development keys and Clerk test addresses. They delete only their own exact temporary accounts. Tests never mutate production Clerk instances; auth traces and persisted session snapshots are disabled. Production deployment remains unapproved and requires production keys, domain/provider settings, privacy/policy review and hosting security configuration.

## D3 consumption and future data boundary

Resources are Admin-owned and Student-consumed. UI capability fields and controlled links are usability safeguards, never authorization. D4 must verify per-student access on every resource preview/download request, validate file content/MIME metadata, provide appropriate Content-Type/Content-Disposition, scan uploads and isolate untrusted file delivery. Signed object-storage URLs should remain behind authorized delivery endpoints or a separately reviewed server contract. No such endpoint/storage service is implemented in D3. Safe preview excludes HTML/SVG/scripts; plaintext is escaped, raster images cannot execute uploaded code, and PDF frames have no script privileges. Browser PDF support may vary; permitted download remains the fallback.

Ticket ownership must be enforced server-side for list/detail/create/reply. D3 stores no tickets in localStorage and never reports successful persistence. Referral codes must be server-issued; qualification/economics and policy remain deferred. Profile editing and credential management stay with Clerk; MentoraLM profile projection excludes internal IDs and secrets. Theme cookies are non-sensitive device presentation preference only and cannot grant access. Public identity flows and all Dashboard guards remain unchanged.

## D4 ownership/security review

D4 implements the previously deferred business authorization boundary. APIs verify Clerk's server session, provision by unique Clerk ID, and derive internal ownership without accepting user IDs. Every profile/course/enrollment/ticket/referral read scopes to the current student; every resource metadata and delivery query includes publication plus assignment/enrollment policy. Unknown/foreign ticket/resource IDs share safe 404 responses. Student role changes, resource management and enrollment creation have no endpoints. Strict Zod schemas reject unknown fields, including role, ownership, staff and publication fields; database writes whitelist fields.

Writes require same-origin JSON, a bounded 16 KiB body, allowed categories and plain text (subject 120, message 4000). Messages render as escaped text. Roles/sender/status are never browser-controlled. Referral codes contain 192 random bits; self-attribution is blocked, repeated same-referrer confirmation is idempotent, changing referrer is denied. Database uniqueness, foreign keys and SQL checks preserve relationships and core invariants. API/private reads disable caching. Errors disclose only stable public messages; logs use non-sensitive operation labels.

Private files use restricted relative storage keys, real-path containment, no-follow opening and a 25 MiB limit. Arbitrary URLs, traversal, absolute paths and escaping symlinks fail. Preview permits PDF, raster images and plain text only, checks binary signatures, and uses sandbox CSP/nosniff/no-referrer headers. Downloads use attachment disposition and octet-stream. Future publication must scan files and validate authoritative metadata; header checks are not malware scanning. The configured root and its parent directories must be controlled by the server operator, never writable by untrusted users. Current provider is local private storage; durable multi-instance/object storage needs a later approved adapter.

Test isolation requires a separate database ending `_test`, `ALLOW_DATABASE_TESTS=1`, and a randomly named test schema created and removed by the harness. Tests never migrate the ordinary runtime database. Clerk test users require Development keys and are removed by exact IDs. Auth traces and persisted session files remain disabled. D4 clean-schema migrations, multi-student ownership/IDOR and populated-runtime checks now pass against local PostgreSQL; see D4 report for exact results. Test guards also reject remote hosts and equivalent local development targets. Explicit Playwright teardown removes the owned test schema and private fixture directory; final checks confirm development business data is untouched. No deployment or production database connection was performed.
