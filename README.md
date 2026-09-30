# MentoraLM

MentoraLM is one unified platform with four product surfaces: Main Public Website, Student Dashboard / Portal, LMS, and Admin Console. **Main Public Website first.**

W1/W2 implements the public frontend foundation, reusable design system, responsive navigation, flagship homepage, motion, and footer. It uses the supplied official logo and a fresh design inspired by the approved concept. Dashboard, LMS, Admin, authentication, databases, business APIs, and additional public pages are not implemented.

## Run locally

Use a supported Node.js LTS release (Node 24 recommended; see `package.json` engines) and npm.

```sh
npm ci
npm run dev
```

Open [the local homepage](http://127.0.0.1:3000). For a production preview, run `npm run build` followed by `npm run start`. No credentials or environment values are required locally.

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

All navigation stays within the homepage in this phase. Menti, login, program enrollment, policies, contact channels, and social URLs await approved later work. Opportunities are marked as planned categories; no metrics, live listings, or testimonials are invented. See [Website](docs/WEBSITE.md) for owner review items.
