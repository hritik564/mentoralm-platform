# R2 — Hero implementation and validation

## Scope and files

R2 replaces only the hero. The approved navbar, module ecosystem, roadmap, AI/Human section, program stories, opportunities, human stories, final CTA, footer, content models, routes, assets and dependencies are unchanged. No authentication, backend, database or future platform work was added. A byte/SHA-256 comparison confirms 52 protected source, test, documentation, asset and configuration files remain unchanged.

Application files:

- Modified: `src/components/home/Hero.tsx`.
- Added: `src/components/home/hero/HeroContent.tsx`, `HeroExperience.tsx`, `HeroVisual.tsx`, `CapabilityCard.tsx`, `IntelligencePaths.tsx`, `GlobalHorizon.tsx`.
- Added: `src/components/menti/Menti.tsx`, `MentiEyes.tsx`, `MentiSpeechBubble.tsx`.
- Added: `src/styles/hero.css`, `src/styles/menti.css`, `tests/hero.spec.ts`.
- Updated documentation: `ASSETS.md`, `ARCHITECTURE.md`, `DESIGN-SYSTEM.md`, `DEVELOPMENT.md`; added this report and eight review PNGs under `docs/reviews/r2`.

## Hero structure

Server-rendered editorial content leads the scene: eyebrow, three-line headline, concise future-facing copy, Explore Programs and Meet Menti actions, and supporting microcopy. Only “a Guess.” uses editorial italic. The visual layers the existing learner photograph, curved frame, thin intelligence arcs, capability surfaces, Menti, and a decorative global horizon. The development disclosure keeps the conceptual capability and horizon language honest.

## Menti

A reusable code-native SVG with a rounded five-point silhouette, cyan/blue/violet/magenta body, expressive eyes, friendly face and graduation cap. Separate eye and speech components permit later reuse. Size and gradient colors accept CSS variables; each instance has unique gradient IDs. Adjacent speech says “Your future AI guide. Coming soon.” Clicking Meet Menti opens the existing honest availability dialog. No chatbot or service is fabricated.

## Capability cards

Four real semantic links use the R1 dark `GlassSurface` system with icons and short captions: Personalized Learning Paths, Global Opportunities, Human Expertise and Career Intelligence. They point to existing editorial anchors. Hover and keyboard focus illuminate the border and gently lift the card. Near-opaque fills keep text readable without adding four backdrop filters.

## Motion

Brief entrances follow the message → student → cards → guide → ambient sequence; headline/actions finish in roughly half a second. Menti breathing/blinking and the atmosphere/path highlight have finite iterations. Pause motion stops animation and pupil movement; Resume motion restarts them. Fine mouse pointers influence pupils within 2.4px/1.8px bounds, throttled to approximately twelve updates per second with one pending animation frame. Meet Menti hover/focus emphasizes its speech and glance. No scroll handler, parallax, pinning or scroll locking was added.

## Responsive behavior

1440px desktop and 1024px landscape tablet retain the layered two-area scene. 768px portrait tablet uses two editorial columns above a centered visual. 390px and 320px stack message, actions, smaller Menti, learner and a readable two-column capability grid. Mobile reduces pathway detail and hides decorative horizon labels. Geometry checks and screenshot inspection cover wrapping, CTA visibility, card/Menti positioning, image rendering, overflow and sticky-navbar compatibility. Cards avoid the learner’s face and essential text/actions. The existing navbar is preserved exactly.

## Reduced motion and accessibility

Reduced motion disables entrances, character loops, path highlights, gaze tracking and positional hover effects, leaving the complete static scene visible. Preference changes reset pupils and hide the motion control. No-JavaScript mode also disables motion/control while retaining editorial content, local imagery and links.

One semantic H1 has an explicit naturally spaced accessible label. CTAs and capability links have visible focus and practical touch targets. Decorative paths, horizon and character are hidden from assistive technology; nearby text supplies Menti’s meaning. The existing native dialog preserves initial focus, Tab containment, Escape and focus restoration. Existing navbar behavior remains covered by its regression suite. Axe WCAG A/AA scans pass for the page, open Menti dialog and navigation states at all six tested widths. Automated axe checks do not constitute full accessibility certification.

## Performance

No runtime dependency, font or raster image was added. The existing local WebP uses prioritized responsive Next.js optimization and a reserved frame. Editorial content, character and decorative SVG are server components; the small hero wrapper owns transient UI state only. Capability cards disable backdrop filtering; the small speech surface uses 8px blur. Motion mainly uses transform/opacity with one small SVG stroke-dash highlight. No heavy animation engine, canvas, WebGL, video or remote asset is used. The homepage remains statically prerendered. Field Core Web Vitals have not been measured.

## Executed validation

- `npm run typecheck` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run format:check` — passed.
- `npm run build` — passed; homepage and not-found routes statically prerendered.
- `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm test` — 87 passed, three intentional mobile-only skips at desktop widths, zero failures across six Chromium viewport projects: 320, 390, 768, 1024, 1440 and 1920px.

Eighteen new hero checks cover capability geometry/readability/destinations, imagery, dialog keyboard behavior, pause/resume, reduced-motion tracking reset and review captures. Existing page/SEO/no-JavaScript/image/anchor/overflow/runtime-error/axe and navigation checks remain enabled. Development failures identified a small portrait-tablet card/Menti overlap, a dialog eyebrow color inherited from the hero, and pupil reset transition during pause; all were corrected and the complete suite passed afterward. A test locator was also corrected to survive the button’s Pause/Resume accessible-name change.

## Owner review screenshots

- [Desktop hero — 1440px](reviews/r2/desktop-1440.png)
- [Landscape tablet — 1024px](reviews/r2/tablet-1024.png)
- [Portrait tablet — 768px](reviews/r2/tablet-768.png)
- [Complete mobile hero — 390px](reviews/r2/mobile-390.png)
- [Complete narrow mobile hero — 320px](reviews/r2/narrow-mobile-320.png)
- [Meet Menti keyboard reaction — 1440px](reviews/r2/menti-focus-1440.png)
- [Reduced-motion static opening — 1440px](reviews/r2/reduced-motion-1440.png)
- [Mobile opening and preserved navbar — 390px](reviews/r2/mobile-opening-390.png)

All six widths were visually inspected, including the corrected portrait-tablet composition. The mobile complete captures show the entire hero; opening captures also show the preserved navbar. Additional per-project screenshots remain in Playwright's ignored `test-results` output.

## Limitations and owner review

Review Menti’s final character personality and the existing illustrative learner photograph for brand fit. The photograph remains fictional campaign imagery, as documented in `ASSETS.md`. Menti is upcoming, and conceptual cards link to existing public explanations rather than live product functionality. Safari/Firefox, real-device screen-reader review and production network/field performance remain unmeasured. No deployment was performed. Work stops at the hero.
