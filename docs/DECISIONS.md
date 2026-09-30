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
