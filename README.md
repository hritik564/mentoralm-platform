# MentoraLM

MentoraLM is one unified platform with four product surfaces: Main Public Website, Student Dashboard / Portal, LMS, and Admin Console. **Main Public Website first.**

W1/W2 implements the public frontend foundation, reusable design system, responsive navigation, flagship homepage, motion, and footer. It uses the supplied official logo and a fresh design inspired by the approved concept. D1 adds Clerk identity, public account actions and a protected Student Dashboard foundation. LMS, Admin, business databases and business APIs remain deferred.

## Run locally

Use a supported Node.js LTS release (Node 24 recommended; see `package.json` engines) and npm.

```sh
npm ci
npm run dev
```

Open [the local homepage](http://127.0.0.1:3000). For a production preview, run `npm run build` followed by `npm run start`. The public homepage works without credentials; account access and Dashboard require the two Clerk keys in `.env.example`, supplied through ignored `.env.local`. Missing keys leave sign-in unavailable and Dashboard closed.

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
