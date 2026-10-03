# MentoraLM

MentoraLM is one unified platform with four product surfaces: Main Public Website, Student Dashboard / Portal, LMS, and Admin Console. **Main Public Website first.**

W1/W2 implements the public frontend foundation, reusable design system, responsive navigation, flagship homepage, motion, and footer. It uses the supplied official logo and a fresh design inspired by the approved concept. D1 adds Clerk identity, public account actions and a protected Student Dashboard foundation. D4 adds PostgreSQL/Prisma business persistence and student ownership APIs. L1 adds the protected LMS learning shell, course outlines, operational Student IDs and batch/instructor architecture. L2 adds secure lesson delivery, the course player and derived lesson progress. L3 adds question-bank-based Quiz/Assessment attempts, assignment versions/review, attendance and explicit final completion/certificate policies. L4 finalizes typed academic resume, Home integration, authorized discussions, consent-aware Batch communication planning, transactional events and application security hardening. Admin and intelligence systems remain deferred. See [L4 report](docs/L4.md).

## Run locally

Use a supported Node.js LTS release (Node 24 recommended; see `package.json` engines) and npm.

```sh
npm ci
npm run dev
```

Open [the local homepage](http://127.0.0.1:3000). For a production preview, run `npm run build` followed by `npm run start`. The public homepage works without credentials; account access and Dashboard require the two Clerk keys in `.env.example`, supplied through ignored `.env.local`. Missing keys leave sign-in unavailable and Dashboard closed. Student business data additionally requires DATABASE_URL and committed migrations; unavailable database configuration renders an honest unavailable state. See [D4 setup](docs/DEVELOPMENT.md#d4-postgresql-setup-and-validation) and [D4 report](docs/D4.md).

## Validate

```sh
npm run typecheck
npm run lint
npm run format:check
npm run build
npx playwright install chromium
npm test
```

Browser tests start their own production server on port 3100 and cover mobile, tablet, desktop, and large desktop. Run the build first. Screenshots and the HTML test report are ignored artifacts under `test-results/` and `playwright-report/`.

## Foundation

Next.js 16 App Router, React 19, strict TypeScript, plain CSS tokens, self-hosted DM Sans / Newsreader, ESLint, Prettier, Playwright, and axe. No animation library is required. See [Architecture](docs/ARCHITECTURE.md), [Design system](docs/DESIGN-SYSTEM.md), and [Development](docs/DEVELOPMENT.md).

Read [AGENTS.md](AGENTS.md) before contributing.

| Document                                   | Purpose                                                 |
| ------------------------------------------ | ------------------------------------------------------- |
| [Product](docs/PRODUCT.md)                 | Platform context, priorities, boundaries                |
| [Architecture](docs/ARCHITECTURE.md)       | Ownership, frontend composition, future compatibility   |
| [Website](docs/WEBSITE.md)                 | Homepage narrative and current scope                    |
| [Future platform](docs/FUTURE-PLATFORM.md) | Deferred Dashboard, LMS, Admin responsibilities         |
| [Security](docs/SECURITY.md)               | Trust boundaries and security requirements              |
| [Development](docs/DEVELOPMENT.md)         | Setup, dependencies, workflow, testing                  |
| [Decisions](docs/DECISIONS.md)             | Confirmed ADRs and unresolved questions                 |
| [Design system](docs/DESIGN-SYSTEM.md)     | Brand, tokens, motion, accessible interactions          |
| [Assets](docs/ASSETS.md)                   | Official references, illustrative imagery, replacements |

Marketing discovery stays within the homepage; account navigation leads to the protected Dashboard. Menti services, program enrollment, policies, contact channels, and social URLs await approved later work. Clerk account access and the D1 Dashboard shell are implemented. Opportunities are marked as planned categories; no metrics, live listings, or testimonials are invented. See [Website](docs/WEBSITE.md) for owner review items.

## Student Dashboard (D1)

Use one Clerk instance for the public Website and Student Dashboard. Configure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` locally as described in `.env.example`, then rebuild/restart. Provider settings control identity fields, login methods and recovery. Never put the secret key in a public variable.

Routes: `/dashboard`, `/dashboard/courses`, `/dashboard/resources`, `/dashboard/support`, `/dashboard/referral`, `/dashboard/profile`. All require server-verified identity. The six pages contain foundations and honest development states; no LMS, ticketing, referral rules or profile editing is implemented. See [D1 report](docs/D1.md).

Run `npm run test:d1` after building for focused desktop/mobile validation. With Clerk development keys, this suite creates temporary `+clerk_test` accounts through signup, exercises real login/session/logout and deletes only those exact accounts. It never mutates a production instance. Authentication traces/storage files are not captured. The existing marketing suite remains available through `npm test`; D1 tests run separately.

## Student Dashboard (D2)

Overview now provides Continue Learning, a My Courses preview, four shortcuts and a future resource boundary. My Courses has Enrolled (default) and Viewed tabs. Normal runtime has no course records, browsing history or invented progress. Explore Programs links to the existing `/#programs` section.

Typed presentation contracts prepare D4 integration without a database. Learning targets are deployment-controlled identifiers resolved centrally; no LMS destination is configured yet. The LMS remains responsible for authorization and learning state. See [D2 report](docs/D2.md) and [Architecture](docs/ARCHITECTURE.md).

After building, run `npm run test:d2` for focused 1440px/390px coverage. Development Clerk keys enable temporary test users with real provider names, removed after each test. Fixtures render only in the test harness; no development fixture route ships with the app. D1 and marketing suites remain separate.

## Student Dashboard (D3)

Resources now provides student-only search/filter and safe preview/download presentation. Support has a validated ticket composer plus reusable list/conversation/detail components, with explicit unavailable submission. Referral has controlled copy/share contracts and no invented rewards. Profile displays actual Clerk identity and launches provider account management; education, notifications and privacy preferences remain future boundaries.

A top-bar Light/Dark toggle applies only to Dashboard semantic tokens. A validated device cookie scoped to `/dashboard` is read on the server, avoiding a theme flash on reload. Light is the initial default. The sidebar stays dark in both modes; public website styling is unchanged.

Run `npm run test:d3` after building. Tests create/delete exact temporary development users and bundle fixture components through Next's existing Webpack and TypeScript dependencies; no fixture route or new dependency ships. Runtime resource/ticket/referral records stay empty until D4. See [D3 report](docs/D3.md).

L1 scope and validation are recorded in [the LMS report](docs/L1.md); [migration and test instructions](docs/DEVELOPMENT.md#l1-migration-and-learning-validation) reuse the existing local PostgreSQL and Clerk Development configuration.

L1 domain/access addendum locks LMS to `students.mentoralm.com` for future deployment, sharing the existing platform identity/database. Authentication alone does not enable LMS: a PostgreSQL student override or applicable enabled active batch is required before course enrollment authorization. Local `/learn` remains available; see `docs/L1.md` and `docs/DEVELOPMENT.md` for safe domain configuration.

L2 implementation and validation are recorded in [the learning experience report](docs/L2.md). It supports structured text, private video/PDF/images, approved external targets, explicit completion, resume and LMS course resources. Dashboard reads the LMS progress projection; lesson progress does not imply graduation/certificate eligibility.

L3 implementation and validation are recorded in [the academic engine report](docs/L3.md). Academic final-completion and certificate issuance are separate Course opt-ins; no Admin/Instructor UI or intelligence interpretation is included. See [local validation](docs/DEVELOPMENT.md#l3-local-academic-validation) for isolated tests and optional private upload configuration.

## Production foundation (P1)

P1 prepares configuration, startup, pooled database access, guarded operator commands, health/readiness and structured logs without deploying or contacting Production. Start with [Production architecture](docs/PRODUCTION-ARCHITECTURE.md) and [deployment runbook](docs/PRODUCTION-DEPLOYMENT.md). Provider preparation now targets Replit Reserved VM and independent Neon Singapore PostgreSQL, with fail-closed Upstash limits and safe best-effort Better Stack logs. See [provider settings](docs/PRODUCTION-PROVIDERS.md) and [validation](docs/PRODUCTION-PROVIDERS-VALIDATION.md). No live resources, deployment or Production connection have occurred; private storage/video/delivery remain P2. Generic npm migration commands refuse: use documented guarded local commands or explicit future Production operator commands.
