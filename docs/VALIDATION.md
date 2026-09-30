# W1/W2 implementation validation

Validated on 30 September 2026 (Asia/Kolkata). Because the project moved from the configured workspace to the Desktop during the task, implementation and full checks ran in `/private/tmp/mentoralm-w1` before transferring the validated files into the actual Desktop repository. The transferred source is checked for byte equality; no push or deployment is performed.

## Executed results

| Check                                                               | Actual result                                                                                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm ci --offline --no-audit --no-fund`                             | Passed; clean lockfile install from local npm cache                                                  |
| `npm run typecheck`                                                 | Passed                                                                                               |
| `npm run lint`                                                      | Passed with zero warnings                                                                            |
| `npm run format:check`                                              | Passed                                                                                               |
| `npm run build`                                                     | Passed; homepage statically prerendered by Next.js 16.3.7                                            |
| `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm test` | 36 passed; final run 10 seconds                                                                      |
| Original ADR preservation                                           | ADR-001 through ADR-007 unchanged                                                                    |
| Official logo integrity                                             | Public JPEG byte-identical to supplied original                                                      |
| Local documentation links                                           | Passed                                                                                               |
| Scope review                                                        | Only `src/app/page.tsx` and `src/app/layout.tsx`; no custom APIs, future surfaces, auth, or database |

The test suite uses actual Chromium at 390×844, 768×1024, 1440×1000, and 1920×1080. It additionally checks 320px layout and accessibility with the mobile menu open. It checks SSR metadata/content, exact seven-module structure, canonical-origin validation, image loading, real hash targets, overflow through all sections, absence of browser console/runtime errors, keyboard navigation, future-feature notices, dialog focus wrapping/Escape/restoration, native Opportunities disclosure, reduced motion, no-JavaScript readability, and axe WCAG A/AA rules.

Actual opening screenshots were visually inspected at all four sizes; desktop full-page and mobile/desktop ecosystem screenshots were also inspected. Visual review led to readable accent contrast, mobile typography sizing, retained paragraph breaks, and floating labels moved below faces on narrow layouts. Generated images and both official references were inspected directly. Screenshot/report artifacts live in ignored `test-results/` and `playwright-report/`.

## Implementation inventory

- Configuration: `package.json`, npm lockfile, `tsconfig.json`, `next.config.ts`, generated `next-env.d.ts`, `eslint.config.mjs`, Prettier config/ignore, `.gitignore`, `.env.example`, `playwright.config.ts`.
- Composition: `src/app/layout.tsx` and `src/app/page.tsx`.
- Layout/navigation: `Brand`, `Navbar`, `Footer`.
- Homepage: `Hero`, `Credibility`, `Ecosystem`, `Purpose`, `Journey`, `Intelligence`, `FeaturedStories`, `Opportunities`, `HumanStories`, `FinalCta`.
- Shared presentation/interaction: `ProgramCard`, `MotionObserver`, `ButtonLink`, `Icon`, `NoticeButton`.
- Content/configuration: `src/content/programs.ts`, `src/content/home.ts`, `src/lib/site.ts`.
- Design: `src/styles/tokens.css`, `src/styles/global.css`.
- Assets: unchanged official JPEG, derived official-symbol favicon, learner/collaboration/campus WebP images.
- Tests: `tests/home.spec.ts` (nine scenarios across four viewport projects).
- Documentation: existing engineering/product/architecture/security/website/development/decision documents updated; `DESIGN-SYSTEM.md`, `ASSETS.md`, and this validation report added. Future platform document preserved.

## Review and remaining limits

Owner review is needed for the editorial visual direction, official-logo crop treatment, illustrative generated imagery, and unapproved public copy. A vector/transparent official logo is desirable for small-size flexibility. Approved program details, legal/contact/social content, canonical domain, metrics, and learner stories remain pending. Menti, login, enrollment, and real opportunities are explicitly unavailable. No company facts or accreditation details were invented.

Automated scans and Chromium visual review do not prove complete accessibility or production device/network performance. Safari/Firefox, assistive technology, real-device performance, hosting/security headers, and content/legal approvals remain pre-launch work. No Lighthouse score, Core Web Vitals certification, or cross-browser pass is claimed. Dashboard, LMS, Admin, backend, authentication, database, additional public pages, push, and deployment were not performed.
