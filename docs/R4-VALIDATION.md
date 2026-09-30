# R4 — Journey / Roadmap implementation report

Implemented and validated on 2026-09-30. Scope ends at the existing Journey section. `AGENTS.md`, Architecture, Development, Website, Design System, Decisions and Assets documentation were inspected first. The approved local reference is `Reference/Roadmap.png`; its capitalization differs from the brief's `reference/roadmap.png`.

## 1. Files changed

| Area                   | Files                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing section entry | `src/components/home/Journey.tsx`                                                                                                                                |
| Server composition     | New `src/components/home/journey/JourneySection.tsx`, `JourneyStep.tsx`, `JourneyMentiGuide.tsx`, `JourneyPath.tsx`, `JourneyLandscape.tsx`, `JourneySymbol.tsx` |
| Local interaction      | New `src/components/home/journey/JourneyExperience.tsx`                                                                                                          |
| Presentation           | New `src/styles/journey.css`                                                                                                                                     |
| Editorial content      | Journey export only in `src/content/home.ts`                                                                                                                     |
| Tests                  | New `tests/journey.spec.ts`; `tests/modules.spec.ts` extends exact shared-Menti geometry comparison from two instances to three                                  |
| Documentation          | `docs/ARCHITECTURE.md`, `DESIGN-SYSTEM.md`, `WEBSITE.md`, this report and review evidence under `docs/reviews/r4/`                                               |

The [scope audit](reviews/r4/scope-verification.json) confirms **67 baseline source/test/asset/config files unchanged**. Other exports in `content/home.ts` are unchanged. The reference was supplied by the owner and was not altered. No protected scene, asset, dependency, navigation or shared Menti implementation changed.

## 2. Roadmap architecture

The existing Journey component delegates to JourneySection. Small server components separate editorial markup, milestones, route, scenery, symbols and guide. JourneyExperience receives server-rendered children and owns only transient UI emphasis and its independent pause state. There is no onboarding state, persistence or program enrollment behavior.

## 3. Menti reuse

JourneyMentiGuide renders the **exact existing Menti component**. No prop extension, duplicated geometry, raster mascot, costume or expression system is introduced. Existing bounded pupil variables and `mentiGazeToward` are reused locally. SVG identifiers remain unique across all three instances; the existing module test now checks that all three characters share the same geometry. Hero/Module pause, gaze and blink behavior pass their original tests.

## 4. Visual composition

The approved reference informs the airy atmosphere, rising journey and supportive central guide. The implemented environment uses pale blue/lilac/peach CSS gradients, subtle mountains, a distant city, decorative birds and soft radial clouds. Navy text, Newsreader editorial emphasis, numbered markers and frosted-looking high-opacity cards provide hierarchy. Desktop has six readable stages across one rising route, rather than a split hero. No reference image is embedded as a website background.

The horizon transition is contained in Journey. The existing **Purpose section remains between Modules and Journey**; page order and all protected sections remain unchanged. The [transition capture](reviews/r4/modules-to-journey-transition.png) shows that actual sequence.

## 5. Stage content

The centralized journey record contains the exact approved order: Feeling Stuck; Understand Yourself; Explore Possibilities; Build Skills & Profile; Access Opportunities; Move Forward Confidently. All six approved descriptions are retained. The heading and supporting line match the brief. Menti's bubble says “I’ll guide you step by step,” identifies Menti as a future AI guide, and the section notes that guidance/matching are in development.

## 6. Interaction

Mouse hover and keyboard focus emphasize the stage, marker and incoming route. Enter, Space or tap toggles one stage's local emphasis with `aria-pressed`; no modal, navigation, chat or saved progress is implied. Focus takes precedence over hover, then selected emphasis. Fine-pointer hover lifts the panel 3px and rotates its icon 5deg. Existing pupils look toward the active stage within 2.4px horizontal / 1.8px vertical limits. Leaving the stage resets transient emphasis; selection remains until toggled off or another stage is selected.

A section-local ResizeObserver updates target geometry and is disconnected on cleanup. No pointer-tracking frame loop or global scroll listener is added. The existing page observer reveals only the heading/guide. Natural scrolling remains intact.

## 7. Responsive behavior

Above 1100px, six milestones read left to right along a gently rising route. Tablet uses three columns and an explicit return connection from 03 to 04. At 700px and below, the same ordered list becomes a vertical guided journey with a colored connector and Menti above it. At 320px panels and copy remain readable, with full-card touch areas and a comfortably padded pause control. All content remains in natural document flow; section crops show the full experience and viewport captures show actual visible portions.

Reviewed: 1920×1080, 1440×1000, 1024×768, 768×1024, 390×844 and 320×740. No overlap, clipped text or document-level horizontal overflow was found. [Geometry observations](reviews/r4/review-observations.json) record all six sizes.

## 8. Reduced motion

The shared Menti CSS and section styling disable character float/blink, gaze, hover movement and transitions under reduced motion. Full content, focus outlines and static emphasis remain. No continuous path animation is added. An independent Journey pause control also stops its character motion and gaze without changing Hero or Modules. Without JavaScript, content and scenery remain visible, Menti is static and enhancement buttons are disabled; the pause/instruction row is hidden.

## 9. Accessibility

The section has a named h2, an ordered six-stage list and h3 milestone titles in natural reading order. Stage buttons expose their names, description relationships and pressed state. A 3px blue keyboard outline surrounds the full panel; comfortable full-card targets support touch. Dark text sits on high-opacity light surfaces. All scenery, route artwork and icon cues are decorative and hidden from assistive technology. No essential content is hover-only.

Keyboard Tab/Enter/Space, responsive geometry, no-JavaScript readability, preference changes and axe WCAG 2.1 A/AA scans pass at all six browser projects. Whole-homepage axe checks also pass. Automated scans and visual checks supplement rather than replace assistive-technology review.

## 10. Performance impact

No dependency, raster image, font, video, canvas, WebGL, animation library, backend or network integration is added. The landscape/path are small inline SVGs; the atmosphere is static CSS. Panels use high-opacity fills without backdrop blur. Existing local fonts, native motion and shared Menti are reused. The homepage still prerenders statically. No field Core Web Vitals benchmark was performed.

## 11. Tests/checks actually executed

Final code passes:

- `npm run typecheck`
- `npm run lint` — zero warnings
- `npm run format:check`
- `npm run build` — production build and static homepage prerender
- `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm test -- --workers=1` — **151 passed, 5 intentional skips**, 156 total, approximately 2.2 minutes

The same five skips apply to mobile-navigation cases outside their layout and carousel cases at orbital desktop widths. The full suite includes all 24 new Journey cases plus existing Hero, Modules, Navbar, availability, no-JavaScript, overflow and accessibility regressions. Serial execution follows the existing documented timing-sensitive parallel navigation limitation; no navigation test or implementation was changed.

Two initial focused runs exposed a test measuring hover while native smooth focus scrolling was still running (22 passed, 2 failed each). Pointer-event inspection confirmed the page moved out from under the pointer. The test now settles that scroll with native instant positioning before measuring hover; both isolated desktop cases and the final complete suite pass. No sleeps, retries or weakened interaction assertions were added. Visual review also corrected the tablet return route and its SVG gradient coordinates so horizontal route segments render.

Reduced-motion [pixel comparisons](reviews/r4/regression-comparison.json) confirm **zero differing pixels** for Hero at 1440×886 and the complete Modules section at 1440×944 against captures taken before implementation.

## 12. Owner-review screenshots

| Review state        | Evidence                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Complete desktop    | [1440×1000](reviews/r4/default-1440-1000.png), [1920×1080](reviews/r4/default-1920-1080.png)      |
| Desktop interaction | [Hover](reviews/r4/desktop-hover.png), [keyboard focus](reviews/r4/desktop-keyboard-focus.png)    |
| Tablet              | [1024×768](reviews/r4/default-1024-768.png), [768×1024](reviews/r4/default-768-1024.png)          |
| Mobile              | [390×844](reviews/r4/default-390-844.png), [selected stage](reviews/r4/mobile-selected-stage.png) |
| Narrow mobile       | [320×740](reviews/r4/default-320-740.png)                                                         |
| Reduced motion      | [Static desktop](reviews/r4/reduced-motion-desktop.png)                                           |
| Section transition  | [Modules → existing Purpose → Journey](reviews/r4/modules-to-journey-transition.png)              |
| Hero regression     | [Before](reviews/r4/hero-before.png), [after](reviews/r4/hero-after.png)                          |
| Modules regression  | [Before](reviews/r4/modules-before.png), [after](reviews/r4/modules-after.png)                    |

The six `default-*-viewport.png` files additionally record actual viewport portions rather than complete section crops. All six sizes and the interaction/reduced-motion/transition compositions were visually inspected.

## 13. Remaining limitations

- Owner review of the landscape, rising route, milestone proportions and future-guide wording remains the design review item.
- Guidance and opportunity matching are planned capabilities, explicitly identified in the section; this task implements their public narrative only.
- Chromium was verified. Safari, Firefox, physical devices, assistive technologies and field performance remain unverified.
- The existing parallel Navbar test timing limitation remains documented in R3.1; this task's complete serial suite passes.

R4 stops here. AI/Human and all later sections were preserved; no platform/backend work was started.
