# Development workflow

## Repository status

The repository now contains the W1/W2 public frontend. Use Next.js App Router, React, strict TypeScript, and the existing npm lockfile. Only the homepage and shared frontend foundation are authorized. Do not initialize future systems.

Read [../AGENTS.md](../AGENTS.md), relevant domain documents, and [Decisions](DECISIONS.md) before work. Website is first; other surfaces remain deferred unless explicitly requested.

## Change discipline

1. Inspect relevant files and understand current behavior.
2. Confirm requested scope and identify affected domain and trust boundaries.
3. Surface ambiguity that materially affects architecture instead of inventing policy.
4. Make the smallest coherent change; avoid unrelated redesign and future-phase implementation.
5. Run relevant validation or tests that actually exist.
6. Review the diff and report changes, verification, and limitations accurately.

Update documentation and accepted decisions when approved changes affect them. Record assumptions separately. Proposals are not authorization to implement another phase.

## Validation expectations

For documentation, review links, consistency, scope, state ownership, security principles, and absence of unapproved stack decisions or implementation artifacts.

When implemented, important business rules, authorization, cross-user access, enrollment lifecycle, learning progress, and assessment scoring require meaningful tests. Bug fixes should include regression tests when practical. Select validation appropriate to the affected behavior and do not claim unexecuted tests passed.

## Environment and dependencies

Keep environment-specific configuration separate from business logic. Never hardcode production credentials, commit secrets, or expose secrets in client bundles. Document required configuration and safe examples after the stack is approved; do not invent provider configuration now.

Dependencies need concrete justification. Prefer maintained and well-supported packages, avoid duplicating stack capabilities, and explain significant infrastructure additions. Next.js, React, TypeScript, and frontend tooling are selected. Database, ORM, authentication provider, cloud service, and deployment platform remain unselected.

Use strong TypeScript types and document any necessary `any`. Keep modules small, business rules outside UI, and abstractions grounded in recurring needs.

When database work begins, use migrations, explicit relationships, appropriate constraints, and intentional indexes. Destructive schema changes require explicit approval. When APIs begin, authenticate, authorize, validate, return structured errors, and preserve established contracts.

## Local setup and checks

Use Node 24 LTS (or another version satisfying `package.json` engines) and npm. `npm ci` installs reproducibly from the lockfile. `npm run dev` starts local development on 127.0.0.1:3000. Production preview uses `npm run build` then `npm run start`. No environment configuration is required locally.

Run `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run build`. Install the browser with `npx playwright install chromium`, then run `npm test`. Playwright starts its own production server on 3100; keep that port available. For a restricted environment, an explicit `PLAYWRIGHT_BROWSERS_PATH` can point to an approved writable browser cache. `npm run format` formats repository source and documentation.

The Chromium projects exercise 390×844, 768×1024, 1440×1000, and 1920×1080, plus narrow 320px checks. They cover SSR/SEO, the seven-module contract, valid origin configuration, image loading, anchor integrity, overflow, browser console errors, navigation keyboard behavior, future-feature dialog focus/closing, native opportunity disclosure, reduced motion, no-JavaScript readability, and axe WCAG A/AA checks. They also capture screenshots for actual visual review; automated checks do not replace manual review or prove complete accessibility/performance compliance. Firefox, Safari, assistive-technology review, and production device/network performance are still release validation work.

## Direct dependency purposes

- Runtime: `next`, `react`, `react-dom` provide public rendering and composition; `@fontsource/dm-sans` and `@fontsource/newsreader` supply locally bundled fonts without runtime font requests to third parties.
- Type checking: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`.
- Lint: maintained ESLint 10 with `@eslint/js`, `typescript-eslint`, `@next/eslint-plugin-next`, `eslint-plugin-react-hooks`, and `globals`. Rules are composed directly to avoid the older React/import/accessibility plugin peer constraints in the Next.js preset. Browser accessibility is tested with axe. See [Next.js ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint).
- Formatting: `prettier`.
- Browser testing: `@playwright/test` and `@axe-core/playwright`; development-only.

No UI component kit, animation library, CMS, analytics, database, authentication provider, or infrastructure service was added. Image resizing used the `sharp` dependency already supplied by Next.js; no extra application package was required.

## Public origin and launch preparation

The optional `NEXT_PUBLIC_SITE_URL` must be an approved absolute HTTP(S) origin without credentials, path, query, or fragment. Set it before the production build to emit a canonical homepage URL and Open Graph URL. Unset configuration omits canonical metadata instead of inventing a domain. Open Graph title/description are present; a sharing image awaits approval. Do not publish until hosting, policies, public content, and available user journeys have been reviewed.

## R1 shared presentation workflow

Import `GlassSurface` for readable dark/light/elevated surfaces. Use `interactive` only alongside real semantic interactive content; it does not assign a role or click behavior. Use the `glow-action` class on `ButtonLink` for a primary brand action. Typography role utilities and `AmbientField` are opt-in for subsequent authorized section tasks; do not apply them globally to existing scenes. Place `AmbientField` inside a positioned, isolated parent and keep important content outside decorative layers.

Use `Reveal` under the existing single `MotionObserver`; `variant="scale"` and `stagger={0|1|2}` reuse shared tokens. Server-rendered content must remain visible without JavaScript. Keep future appearance changes in the semantic token layer, `foundation.css`, or scoped `navigation.css`. `Navbar tone="light"`/`"elevated"` provides a future appearance extension point without adding section detection.

The Playwright matrix now also includes 320×740 and 1024×768, alongside the original four projects. `navigation.spec.ts` checks sticky anchoring, a stable header footprint, reduced-motion compaction, mobile focus containment, body/inert cleanup, nested Login dialog focus, and resizing back to desktop. It captures top, sticky and mobile-menu artifacts for visual inspection. Existing homepage regression and axe scans remain enabled. Final executed results are recorded in `R1-VALIDATION.md`; do not infer passing status from this workflow description.

## R2 hero workflow

Compose hero-specific server components through `HeroExperience`; keep editorial content outside the client interaction boundary. Import `hero.css` from `Hero` and `menti.css` from `Menti`. Keep the existing content models and navigation untouched. `tests/hero.spec.ts` adds geometry/readability, real destination, honest Menti dialog, pause/resume, reduced-motion tracking-reset and staged/focus screenshot checks to the existing six-width production browser suite. Owner screenshots and final executed results are recorded in `R2-VALIDATION.md`. Menti is a visual character only; no assistant service is connected.
