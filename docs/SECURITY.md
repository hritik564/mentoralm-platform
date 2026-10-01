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

## L1 LMS security

LMS routes independently require verified Clerk identity; repositories additionally require the mapped STUDENT role and own Enrollment for published course outlines. Batch membership, Student ID, Batch Code, arbitrary URL knowledge and client user IDs are never course access grants. Server projections omit user/membership/enrollment primary keys, Clerk IDs, lesson storage references and unpublished items. Instructor/Admin roles do not gain Student LMS access or new mutation capability.

Student ID issuance is enforced by a PostgreSQL trigger/sequence and uniqueness/format/required checks; explicit insertion or modification is rejected even through ordinary internal ORM writes. Existing profile mutation whitelists reject Student ID, roles and ownership fields. Composite role foreign keys prevent student/instructor impersonation in batch relationships. Students have no batch, membership, instructor assignment, curriculum or role mutation endpoints. Course handoff accepts only validated internal identifiers and is reauthorized at the LMS boundary.

L1 tests reuse D4's local-only isolated database guards and exact-schema teardown. They cover fresh migrations, a populated D4 upgrade fixture, concurrent identity issuance, ID immutability, mixed curriculum ordering, role boundaries, cohort/enrollment separation, two real Clerk sessions and URL tampering. Future Admin will own authoring/publishing/cohort assignment; future file delivery must retain D4's access/scanning boundaries. No files/playback or learner state are delivered by L1.

## L1 entitlement and domain enforcement

Authentication is not LMS authorization. Server-derived STUDENT identity must match PostgreSQL entitlement on each workspace read, with entitlement also included in enrolled-course query predicates. Student ENABLED/DISABLED overrides inherited batch access; applicable active membership/batch dates are evaluated server-side. Unknown/no-override accounts deny by default. Membership and entitlement are separate from Enrollment. Tests cover revocation without a session change, conflicting cohorts, disabled overrides, date/status exclusions, guessed IDs and profile mass-assignment attempts. No student entitlement/batch/enrollment mutation endpoints exist; future Admin setters require explicit permission and audit.

Approved production destinations are mentoralm.com and students.mentoralm.com only (explicit HTTP loopback origins are supported for isolated local configuration). Redirect input must exactly match approved routes/origins; traversal, suffix-host spoofing, credentials, query/fragment and arbitrary origins are rejected. LMS host rewrites retain Clerk authentication and business checks. Deployment ingress must accept only configured hosts and control forwarded headers. No manual shared-session cookie or second Clerk instance is introduced.

## L2 learning requests

Every outline, selected lesson, media/range/captions/resource request and state mutation derives the existing server STUDENT actor and verifies current LMS entitlement, own Enrollment, published Course, Section and correct LearningItem/Lesson relationship. State queries filter the current User, never a supplied owner ID. POST bodies are strictly empty action commands; existing same-origin JSON/16 KiB limits reject owner IDs, progress values, timestamps and arbitrary input. Serializable transactions with bounded conflict retries guard access/completion; completedAt is idempotent and Enrollment remains untouched. No quiz/assignment completion endpoint exists.

Typed, bounded text blocks render as escaped React text; HTML/attributes/iframe blocks are rejected. Lesson media uses an operator-owned private root, strict storage keys, canonical containment/no-follow opening, size limits, MIME/signature checks, private/no-store/nosniff/sandbox headers and single-byte-range validation. No filesystem key or object URL is projected to students. Download permission controls the explicit endpoint/action; inline bytes are inherently saveable and this is not DRM. File signatures are not malware scanning: future publication must validate/scan trusted media and provide captions/accessibility before production use. Approved external links resolve target IDs through a deployment-owned exact-origin registry; stored arbitrary URLs never become launch actions.

Tests cover two enrolled students' independent state, draft/unrelated lesson IDs, unsupported item mutations, revoked entitlement/enrollment, mass assignment/CSRF, unsafe MIME/path/symlink/ranges and media fallback before hydration. Native mobile outline owns Escape, focus containment/restoration and scroll locking. Student ID/batches remain confined to LMS Home.

## L3 academic security

Student academic routes derive the verified MentoraLM student, enforce current business entitlement, own Enrollment and published Course/Section/item/subtype, and filter every attempt, submission, file and certificate by that student. Persisted correct flags/explanations never enter pre-submit DTOs; snapshot results expose answer review only when configured. Strict bounded response payloads reject owner IDs, scores, progress, reviewer identities and accepted states. Objective grading uses exact option sets; text remains ungraded/requires review. Submission freezes answers and scoring; database triggers additionally reject updates to submitted responses/options and historical version content. Completion and certificate issuance have no student setter/issuance endpoint.

Attempt start/submit, version numbering and course/certificate reconciliation use serializable transactions and uniqueness constraints (including one open attempt per student/activity). File submissions additionally use a UUID request key to make retries idempotent. No client-supplied file key is accepted. Same-origin JSON requests retain 16 KiB bounds; multipart requests are bounded to 52 MiB before parsing and revalidated against the Assignment's stricter file count/size policy. PDF, raster images and UTF-8 plain text only; no HTML, executable, macro office, SVG or arbitrary URLs. Signature checks, generated exclusive private files, cleanup on failed persistence, controlled filenames, containment/no-follow delivery, no-store, nosniff and sandbox headers reuse L2 primitives. Signatures are not malware scanning; production needs quarantine/scanning and crash-orphan reconciliation.

Staff services reread the actor's persisted role, require assigned Batch/Course/Program scope for Instructors and relevant student membership for review. Attendance checks the session's own Batch, membership windows and Course/live-item scope; a SQL trigger enforces membership/session relationship too. Students have no staff endpoint. Review history and audit records retain who changed status; attendance audit actions retain old/new status. Historical records survive membership departure, but revoked workspace/course access still prevents student disclosure. Admin-only certificate revocation is audited and cannot be undone by student activity. Random certificate codes are identifiers, not access grants. Future public verification, Admin authoring and intelligence interpretation remain deferred.

## L4 final security boundaries

Discussion commands are strict whitelists; no author/role/ownership/lock/status fields are accepted. Course and optional Batch access are independently checked on every request, including cursor pages. Serialized replies recheck scope and lock state. Posts render through escaped React text, never HTML/markdown embeds. SQL bounds title/body and protects original context/author/post content. No editing/moderation API ships. Disallowed IDs return generic missing states rather than disclosing cohort information.

API mutations share bounded per-student/per-policy fixed-window guards: learning/academic 120/minute, uploads 10, discussions 20, Support/referral 10, future communication planning 5. The process-local store expires entries, caps memory at 10,000 windows and fails closed on saturation. API guards execute after verified identity and before body parsing/file writes. This is a local abuse backstop, not a distributed DDoS defense; deployment must add ingress limits and use a shared atomic implementation for multiple workers/instances. No user/IP proxy header determines the limiter identity.

Production host routing rejects unknown/malformed authorities before Clerk. Configured origins are the allowlist; login redirects use an approved authority, not a forwarded origin. Clerk `authorizedParties` restricts production sessions to the two configured origins. Local tests retain explicit loopback access and the approved LMS hostname for routing checks. Deployment must terminate TLS at a trusted ingress, reject unknown Host, strip untrusted forwarded headers and forward canonical host/protocol; application checks cannot authenticate arbitrary infrastructure header rewriting.

Communications expose no student or privileged HTTP dispatch endpoint. Persisted role/assigned cohort checks gate audience/planning; marketing is ADMIN-only and opt-in remains channel/purpose-specific. Membership/enrollment/entitlement never supplies consent. Immutable audit details retain permission evidence. Pending records are not successful messages. Dispatch must recheck consent/membership and validate verified contact destinations when a provider is later implemented.

Private Lesson/Resource/Assignment/Certificate deliveries keep separate domain authorization above shared canonical containment/no-follow, signature/type bounds, safe filenames, no-store/nosniff/sandbox and range primitives. No secret keys, storage paths, correct answers before review, student IDs outside LMS or audit/event records enter ordinary student DTOs. Local signatures are not malware scanning. Durable object storage, quarantine, retention, backups and orphan cleanup remain production obligations.
