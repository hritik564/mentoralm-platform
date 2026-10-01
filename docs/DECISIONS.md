# Architecture Decision Record index

Only accepted decisions below are confirmed. Proposals, assumptions, and unresolved questions are not approved decisions. Add future ADRs with context, decision, status, and consequences; record superseding decisions explicitly instead of silently rewriting history.

## Confirmed decisions

| ADR     | Decision                                                                            | Status   |
| ------- | ----------------------------------------------------------------------------------- | -------- |
| ADR-001 | One unified platform with multiple product surfaces                                 | Accepted |
| ADR-002 | Main Public Website is first implementation priority                                | Accepted |
| ADR-003 | Dashboard, LMS, and Admin deferred during website phase unless explicitly requested | Accepted |
| ADR-004 | Eventual unified identity model                                                     | Accepted |
| ADR-005 | Authorization cannot depend on client-side UI state                                 | Accepted |
| ADR-006 | Learning progress belongs to learning domain, not Dashboard                         | Accepted |
| ADR-007 | Program and Course are separate concepts                                            | Accepted |

All seven decisions were supplied by the product owner for this foundation. They establish direction, not technology choices or permission to implement future systems.

### ADR-001 — Unified platform

**Status:** Accepted. **Context:** Four product surfaces must work together. **Decision:** MentoraLM is one unified platform containing Website, Student Dashboard / Portal, LMS, and Admin Console. **Consequences:** Preserve shared capabilities and explicit domain boundaries; this does not require four services or select deployment topology.

### ADR-002 — Website first

**Status:** Accepted. **Context:** Implementation needs a clear first milestone. **Decision:** The redesigned Main Public Website is first priority. **Consequences:** Evaluate current work against website needs while retaining future compatibility. The present foundation task remains documentation only.

### ADR-003 — Deferred surfaces

**Status:** Accepted. **Context:** Future product context could accidentally expand scope. **Decision:** Dashboard, LMS, and Admin will not be implemented during the website phase unless explicitly requested. **Consequences:** Document their responsibilities, but do not build them or speculative infrastructure for them.

### ADR-004 — Unified identity

**Status:** Accepted. **Context:** Students need continuity across Website → Dashboard → LMS. **Decision:** MentoraLM ultimately uses one platform identity model; administrators share identity infrastructure with separate roles and permissions. **Consequences:** Avoid incompatible surface-specific identity designs. Provider, session mechanism, account lifecycle, and deployment details remain open.

### ADR-005 — Server authorization

**Status:** Accepted. **Context:** Client state can be manipulated. **Decision:** Authorization cannot depend on UI state and must be server enforced for protected functionality. **Consequences:** Verify ownership or permission for protected resources and actions; test cross-user denial and prevent IDOR.

### ADR-006 — Learning progress ownership

**Status:** Accepted. **Context:** Dashboard must show learning information without duplicating authority. **Decision:** Learning progress belongs to the LMS/learning domain. **Consequences:** Dashboard consumes progress through approved contracts; no independent authoritative Dashboard progress model.

### ADR-007 — Program and Course

**Status:** Accepted. **Context:** The learning hierarchy is Program → Course → Section → Lesson. **Decision:** Program and Course are separate domain concepts. **Consequences:** Preserve the distinction in later modeling; cardinalities, reuse, and lifecycle rules are not decided here.

## Assumptions deliberately not adopted

The original documentation foundation made no stack or language assumption. W1/W2 subsequently delegates deliberate frontend stack selection (ADR-008). Provider, schema, deployment topology, tenant structure, migration from previous sites, account lifecycle, enrollment lifecycle, pricing/eligibility policy, completion/scoring policy, certificate rule, and detailed permission matrix remain unassumed. No module list is treated as an approved route map or database design.

## Owner input before the next phase

- What public content, navigation, user journeys, and integrations are approved for the first website milestone? Should authentication and application/enrollment entry points link outward, be placeholders, or invoke approved platform capabilities?
- What hosting, budget, operational, privacy, and data-location constraints should guide deliberate stack selection and approval?
- Is the platform for one organization or multiple organizations/tenants, and what identity/account lifecycle requirements must the next architecture support?

Detailed enrollment, learning, assessment, and admin policies can be resolved before their respective implementation phases. W1/W2 authorizes the homepage and frontend foundation. These remaining questions do not authorize work beyond its stop condition.

## W1/W2 implementation decisions

The owner explicitly authorized technology selection and homepage implementation in W1/W2. ADR-001 through ADR-007 remain unchanged.

| ADR     | Decision                                                             | Status             |
| ------- | -------------------------------------------------------------------- | ------------------ |
| ADR-008 | Next.js App Router, React, strict TypeScript, plain CSS, local fonts | Accepted for W1/W2 |
| ADR-009 | Seven positions in one typed public content model                    | Accepted for W1/W2 |
| ADR-010 | Browser-native motion with progressive enhancement                   | Accepted for W1/W2 |
| ADR-011 | Homepage-only journeys with explicit future-availability notices     | Accepted for W1/W2 |
| ADR-012 | Official logo, local illustrative assets, no fabricated evidence     | Accepted for W1/W2 |

### ADR-008 — Public frontend stack

**Status:** Accepted for W1/W2 under owner-delegated selection. **Context:** SEO, public rendering, TypeScript, reusable composition, performance, and future integration are required. **Decision:** Next.js 16 App Router, React 19, strict TypeScript, plain CSS tokens, locally bundled DM Sans / Newsreader; maintained ESLint/TypeScript/Next/React Hooks rules, Prettier, and Playwright/axe. **Consequences:** Homepage is statically prerendered with small interactive boundaries; fonts/images are self-hosted. No backend stack, identity provider, data store, hosting provider, or animation library is selected. See [Architecture](ARCHITECTURE.md) and [Development](DEVELOPMENT.md) for rationale and dependency purposes.

### ADR-009 — Editorial module model

**Status:** Accepted for W1/W2. **Context:** Exactly seven owner-supplied positions must be consistent and extensible. **Decision:** One typed `src/content/programs.ts` model drives ecosystem cards, footer program navigation, and story program labels. Featured and Coming Soon positions use distinct union variants. **Consequences:** Public editorial module records do not stand in for future Program/Course domain records or enrollment availability.

### ADR-010 — Native motion

**Status:** Accepted for W1/W2. **Context:** Motion must support exploration without heavy runtime cost or accessibility loss. **Decision:** CSS transform/opacity transitions, restrained finite hero ambient/orbit motion, hover responses, and one shared IntersectionObserver for one-time scroll reveals. **Consequences:** Native scrolling remains intact. Content is visible without JavaScript; reduced-motion preferences disable animation and reset pending reveals, including preference changes. No numeric counters are added without approved metrics.

### ADR-011 — Honest homepage-only journeys

**Status:** Accepted for W1/W2. **Context:** Additional routes and backend systems are out of scope. **Decision:** Navigation uses homepage anchors and native local disclosures/dialogs for unavailable capabilities. **Consequences:** No broken stub routes, fake sign-in, AI chat, application submission, or fabricated backend responses. Future account actions can be supplied via the Navbar presentation slot; backend authorization remains a later requirement.

### ADR-012 — Brand and assets

**Status:** Accepted for W1/W2; imagery/copy subject to owner review before launch. **Context:** Owner supplied authoritative logo and directional concept. **Decision:** Use the original official logo pixels, controlled brand accents, and three original generated editorial images hosted locally. **Consequences:** The mockup’s fabricated example metrics/testimonial and other pages are not copied. Generated scenes are illustrative, not evidence of participants, outcomes, or partner universities. No external image/font hotlinks, invented addresses, or social URLs. See [Assets](ASSETS.md) for prompts and replacements.

## D1 implementation decisions

### ADR-013 — Clerk unified identity foundation

**Status:** Accepted by explicit D1 owner instruction. **Decision:** Use `@clerk/nextjs` for one account across Website and Student Dashboard, retaining compatibility with future LMS identity. Clerk owns credentials, verification, recovery and session lifecycle. Next.js proxy verifies sessions, and Dashboard server layout/pages independently require the current provider user. No MentoraLM password store or business database is introduced. This supersedes ADR-011's unavailable-login presentation for account access only; other future-feature notices remain.

**Consequences:** Owner keys and provider configuration are required. Missing credentials fail closed. Custom MentoraLM sheets contain the provider forms; identity/business profile collection stays separate. Future learning/resource authorization must still verify ownership and policy. D1 does not grant Admin or enrollment access.

### ADR-014 — Student Dashboard shell and navigation

**Status:** Accepted for D1. **Decision:** Exactly Overview, My Courses, Resources, Support, Referral and Profile share a dark-sidebar/light-workspace shell under `/dashboard`. Settings belongs within Profile; Courses reserves Viewed/Enrolled presentation boundaries. Pages currently use explicit development states. No progress, course records, ticketing, referral business rules or editable profiles exist.

## D2 implementation decision

### ADR-015 — Course presentation snapshots and controlled LMS handoff

**Status:** Accepted under explicit D2 owner scope. **Decision:** Overview and My Courses consume typed Viewed/Enrolled snapshots with an empty runtime source. Enrolled is the default accessible tab. Deployment-owned destination identifiers resolve centrally to strict internal paths or exact trusted HTTPS origins; no learning destination is configured in D2. Fixtures stay exclusively in tests.

**Consequences:** D4 must supply authorized per-student records. LMS still owns progress and verifies every learning access; a presentation link is not permission. No enrollment lifecycle, database, LMS implementation or external learning provider is selected. D1 identity/shell and unrelated public sections remain locked.

## D3 implementation decisions

### ADR-016 — Student consumption and service seams

**Status:** Accepted under explicit D3 scope. **Decision:** Student Resources is consumption-only with typed snapshots, controlled target IDs and browser-safe preview. Support/Referral/Profile use narrow presentation/service contracts and honest empty/unavailable states until D4. Clerk owns account editing/security. **Consequences:** Admin resource management, per-student business authorization, persistence, referral policy and profile business fields remain deferred. No fake local database, reward policy or certificate generation is introduced.

### ADR-017 — Dashboard-scoped device theme

**Status:** Accepted under D3 theme scope. **Decision:** Semantic Dashboard variables plus a server-read, validated `/dashboard` preference cookie implement Light/Dark without a library or reload flash. Initial default is Light. **Consequences:** Theme is device-local and unrelated to auth; public marketing appearance stays unchanged. D4 account preference synchronization requires a later policy.

## D4 implementation decisions

### ADR-018 — PostgreSQL business database and verified subject mapping

**Status:** Accepted under explicit D4 scope. **Decision:** Prisma 7/PostgreSQL with the pg driver adapter, committed migrations and a lazily constructed server client. Clerk owns authentication; a unique Clerk subject maps to an internal User with STUDENT default. Business records do not use Clerk metadata. Strict ownership-scoped repositories project existing Dashboard contracts. **Consequences:** DATABASE_URL and disposable test infrastructure are owner configuration; live verification cannot be inferred from a successful build. D4 supersedes D2/D3 empty/unavailable business adapters. ADMIN exists only as a future role; no Admin mutation/UI is implemented.

### ADR-019 — Restrained student domains and controlled file provider

**Status:** Accepted under D4 scope. **Decision:** Separate Program/Course; unique user/course views and enrollments; published resources available globally, by assignment, or current course/program enrollment; owned plain-text support conversations; random referral identity and one immutable attribution; education/career profile whitelist. Local private-file delivery is an optional controlled provider, with per-request authorization, path/type safeguards and no arbitrary URLs. Preserve device-local theme and null LMS state. **Consequences:** Enrollment/resource publication/scanning, durable storage, cancellation policy, Admin/support staff workflows, LMS learning state and referral economics remain deferred. The invitation entry requires explicit signed-in confirmation; no automatic GET attribution or new auth redirect policy.

## L1 implementation decisions

### ADR-020 — Shared LMS identity and enrollment authority

**Status:** Accepted under explicit L1 approval. **Decision:** Extend the existing User, database and Clerk route guards; LMS is `/learn` in the same Next.js application. STUDENT role plus own Enrollment and published Course authorize outlines. Batch groups delivery but never substitutes for enrollment. Database-issued immutable Student ID is LMS-only. **Consequences:** No disconnected auth/project, no self-assignment APIs, no client role/identifier input; sequence gaps are normal. ADMIN/INSTRUCTOR are distinct and no instructor UI is authorized.

### ADR-021 — Cohorts, ordered items and dark-first shell

**Status:** Accepted under L1 scope. **Decision:** Program/Course remain separate; explicit section/item positions with publication gating; minimal relational Lesson subtype. Batch scope is optional Program or Course, multi-memberships and multi-instructor assignments use role-aware relations, current batch is date/status deterministic. Dark LMS tokens introduce no independent preference storage; existing Dashboard device theme remains intact. **Consequences:** Learning execution/state, content management, communications/sending, marketing consent, Admin workflows and light LMS theme remain later phases. Batch membership is not promotional consent. Dashboard now resolves only approved internal course handoffs and continues to display null learning progress.

### ADR-022 — LMS domain topology and business entitlement

**Status:** Locked by the owner's L1 domain/access addendum. **Decision:** Public/module pages and Dashboard stay on mentoralm.com; LMS uses students.mentoralm.com, served by the same application/Clerk/PostgreSQL identity. This supersedes ADR-020's production `/learn` URL and adds entitlement before enrollment authorization. Nullable student ENABLED/DISABLED override takes precedence; otherwise any applicable active enabled batch grants workspace access. No override/grant means deny. Batch access defaults disabled. **Consequences:** Existing authentication/enrollment alone no longer enables LMS. Local `/learn` remains a development alias. No Clerk entitlement metadata, student mutation API, Admin UI, live domain/DNS change or L2 work. Production cross-subdomain session configuration must be verified when deployment is authorized.

### ADR-023 — L2 manual lesson state and extensible progress projection

**Status:** Accepted under explicit L2 scope. **Decision:** Unique per-student LessonState stores access and explicit completion; only required published lessons with implemented semantics contribute to L2 progress. No editable course percentage or automatic Enrollment completion. One LMS projection controls resume/progress in LMS and Dashboard. **Consequences:** Optional/future items never depress L2 lesson progress; final completion must later aggregate L3 contributors. Curriculum publication changes can alter derived totals.

### ADR-024 — Shared private file mechanism, separate domain permissions

**Status:** Accepted under L2 scope. **Decision:** Reuse bounded private-file opening and validation beneath independent Resource/Lesson/LearningResource authorization. Stream LMS media with range support, typed text blocks, native players and approved external target registry. Dark L1 shell remains unchanged; compact player adds a modal outline below tablet breakpoint. **Consequences:** Production durable storage, scanning, caption publication, authoring and attachment relationships remain future infrastructure/work. No binary database storage, public media keys, new player dependency, learning telemetry or AI.

## L3 implementation decisions

### ADR-025 — Reusable questions and immutable academic attempts

**Status:** Accepted under explicit L3 scope. **Decision:** Question banks/options and ordered associations feed constrained Quiz/Assessment activities. Shared normalized attempt/response/option snapshots retain scoring and review policy at start; student projections omit private keys before configured review. Exact-match objective scoring only; text requires review. **Consequences:** Quiz/Assessment semantics stay separate. No personality/career/intelligence interpretation, deterministic text grading mode, proctoring or time limit is invented. Future authoring must validate published configuration.

### ADR-026 — Versioned assignments and scoped attendance

**Status:** Accepted under explicit L3 scope. **Decision:** Immutable numbered submission content/files, idempotent request keys, latest-version completion and appended reviews; conservative private upload allowlist. Assigned Instructor scope/persisted role protects domain-only review and attendance, with audit. Historical membership windows authorize held-session projection; present/late count, excused excluded, missing remains unrecorded. **Consequences:** No student staff actions, privileged UI or automatic late penalty. Production scanning/durable storage remain infrastructure.

### ADR-027 — Opt-in final completion and certificate issuance

**Status:** Accepted under explicit L3 scope. **Decision:** One required configured-item contributor boundary, optional explicit Course attendance condition, nonempty requirements and Course-level final-completion opt-in. Separate certificate policy; unique student/Course record and random code. Serializable evaluation updates Enrollment and issues at most one record. **Consequences:** Existing L2 Courses remain unchanged by default. Current projections recompute eligibility; publication changes must reconcile. Added requirements reopen status but preserve the first timestamp; certificates suspend/recover with eligibility, manually revoked certificates stay revoked. Only real attached private PDFs enter Dashboard Resources; PDF design/public verification are deferred.

## L4 implementation decisions

### ADR-028 — scoped plaintext learning discussions

**Status:** Accepted under L4. **Decision:** Course enrollment plus current LMS entitlement authorize discussions; optional applicable active Batch membership narrows scope. Server-derived authors, bounded plain text, immutable posts/context and cursor conversation pages. **Consequences:** No student edits/moderation powers, no Support merger or fake Chat; future control-plane moderation is separate.

### ADR-029 — explicit consent and provider-free cohort planning

**Status:** Accepted under L4. **Decision:** Reusable server-only Batch audience resolver, separate channel/purpose preferences with evidence and private history, denied-by-default permissions, auditable message/delivery plans. Student entitlement does not determine cohort membership; marketing is not inherited consent. **Consequences:** PENDING_PROVIDER/SUPPRESSED only; no sends, templates/automation/provider UI or unresolved preference controls. Other audience sources require explicit authorized resolvers.

### ADR-030 — transactional facts, audited access controls and local abuse guard

**Status:** Accepted under L4. **Decision:** Minimal idempotent LearningEvent journal, existing private audit extended with optional details, persisted-role-checked future access service, per-identity bounded local rate policies and explicit production authority/session-origin guards. **Consequences:** No large bus/control-plane interface/provider. Event consumers and shared multi-instance rate storage remain deployment/future work. Root and LMS hosts share the existing Clerk production instance.
