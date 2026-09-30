# R3 — Module Ecosystem implementation and validation

R3 is complete. Only the existing module ecosystem section was redesigned. The Hero, Navbar, original Menti artwork, and other homepage sections remain unchanged. Local production preview: <http://127.0.0.1:3000/#programs>.

## 1. Files changed

| Files                                                                  | Change                                                                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/components/home/Ecosystem.tsx`                                    | Existing section entry now composes the new ecosystem.                                                                 |
| `src/components/home/modules/ModuleEcosystem.tsx`                      | Server-rendered heading, exact existing Menti, centralized seven-card composition.                                     |
| `src/components/home/modules/ModuleCard.tsx`                           | Photographic module cards and honest availability actions.                                                             |
| `src/components/home/modules/ModuleOrbit.tsx`                          | Decorative paths, rings, nodes and restrained stars.                                                                   |
| `src/components/home/modules/ModuleExperience.tsx`                     | Scoped selection, gaze, touch/keyboard events and independent motion control.                                          |
| `src/components/home/modules/ModuleCarousel.tsx`                       | Accessible user-controlled carousel navigation and position announcement.                                              |
| `src/components/menti/gaze.ts`                                         | Bounded card-target direction calculation using existing pupil variables.                                              |
| `src/styles/modules.css`                                               | Section-scoped composition, responsive styling, highlights and motion rules.                                           |
| `src/content/programs.ts`                                              | Five local thumbnail references added to existing featured module records. Names, statuses and destinations preserved. |
| `tests/modules.spec.ts`                                                | Focused responsive, interaction, gaze, availability, motion and accessibility coverage.                                |
| `tests/hero.spec.ts`                                                   | Existing no-JavaScript character assertion scoped to the Hero now that the same Menti is also rendered below.          |
| `tests/home.spec.ts`                                                   | Image-loading verification scrolls lazy images into view before checking completion.                                   |
| `public/images/entrepreneurship.webp`, `public/images/counsellor.webp` | Two optimized local illustrative thumbnails.                                                                           |
| `docs/ARCHITECTURE.md`, `docs/DESIGN-SYSTEM.md`, `docs/ASSETS.md`      | R3 architecture, styling and asset provenance, including final image-generation prompts.                               |
| `docs/R3-VALIDATION.md`, `docs/reviews/r3/`                            | This report, review screenshots and verification evidence.                                                             |

The repository has no tracked implementation baseline yet, so scope was verified against the pre-R3 file hashes rather than inferred from Git's untracked-file listing. [Scope evidence](reviews/r3/scope-verification.json) confirms only the four existing source/test files above changed and 53 existing source, asset and test files remained unchanged. No framework configuration, dependency, global stylesheet, page ordering, Hero, Navbar or original Menti source changed.

## 2. Layout architecture

The existing section remains `#programs`. A centered editorial heading introduces “One Intelligence. Different Paths.” and the short ecosystem line. Server components render the content, cards, original Menti and decorative orbit; a small client wrapper owns only transient interactions. All seven identities come from the existing centralized `programs` content model.

Desktop uses a bounded 1120px orbital stage: GradLM above Menti, AI Career Counselling and CareerIgnite at the upper sides, Entrepreneurship and Career Counsellor Program at the lower sides, and two muted Coming Soon cards below. Responsive coordinates preserve the composition without changing neighboring sections.

## 3. Existing Menti reuse

The section renders the exact existing `Menti` component. `MentiBody`, `MentiFace`, `MentiEyes`, `MentiCap`, gradients, expressions and cap placement are unchanged. There is no second mascot source or duplicated artwork. Existing per-instance SVG identifiers prevent gradient collisions between the Hero and ecosystem. Section sizing and motion use scoped CSS.

## 4. Module-card design

The five featured cards have distinct local photographs, module numbers, icons, titles, concise positioning and visible explore controls. Dark shaded glass, subtle edge color and layered depth replace the previous basic tiles. Blue identifies GradLM; violet/magenta identifies AI Career Counselling; orange/gold identifies CareerIgnite; cyan/teal identifies Entrepreneurship; violet/blue identifies professional counselling. The two Coming Soon cards use restrained abstract rings and lock indicators, with no fake navigation action.

## 5. Orbital/path system

One decorative SVG supplies four concentric elliptical rings, seven thin curved connections, midpoint nodes, a few fixed stars and a gold accent. The selected featured module's connection and node brighten together. Default paths remain subdued. Tablet/mobile use a short connector between Menti and the discovery rail, colored by the selected module. Orbit graphics are hidden from assistive technology.

## 6. Menti gaze behavior

The client wrapper calculates the direction from the rendered Menti center to the selected card center and writes the existing `--menti-gaze-x` and `--menti-gaze-y` variables. Movement stays within the existing 2.4px horizontal and 1.8px vertical limits, with a gentle 240ms transition. Desktop hover/focus release returns the gaze to neutral. Mobile follows the current user-selected card. The Hero's independent gaze behavior and source are preserved.

## 7. Hover behavior

Fine-pointer hover strengthens the dark-glass treatment, accent border and glow; lifts the card by 5px; scales the thumbnail by 4.5%; nudges the arrow; illuminates its connecting path/node; and targets Menti's pupils. Transforms preserve surrounding geometry. Required copy and controls are visible before hover.

## 8. Keyboard behavior

Tab follows the five featured module actions in content order. Focus activates the same card, path, node and gaze as hover, while a prominent focus ring remains visible. Availability buttons reuse the existing accessible dialog, including Escape dismissal and focus return. The unavailable Coming Soon cards add no false tab stops. Carousel arrows remain keyboard accessible and preserve focus during navigation.

## 9. Mobile behavior

At 640px and below, the heading precedes a centered 144px Menti and native horizontal scroll-snap discovery rail. Cards occupy 86% of the rail, leaving a next-card preview. Finger swipes, taps, focus and Previous/Next controls update the active card, connector and gaze. A polite position announcement reports all seven positions. A trailing spacer lets the final card align correctly. Nothing auto-rotates. Without JavaScript, all cards remain visible in a stacked layout.

## 10. Tablet behavior

At 1100px and below, desktop coordinates give way to a deliberate intermediate layout: centered 168px Menti above a rail with 44%-width cards, two readable cards and a partial next preview. No tiny orbital arrangement or overlapping cards is used. The no-JavaScript fallback is a two-column grid.

## 11. Reduced-motion behavior

Reduced motion disables Menti float/blink, gaze movement, positional card hover and thumbnail zoom. Static card highlights, focus borders and selected connector/path colors remain. There are no spinning cards or animated particle systems. A section-specific Pause Menti motion control also stops character animations and pupil transitions without altering the Hero's control. Normal ambient character animations are finite and pause until the section is revealed.

## 12. Accessibility

The section uses a named semantic heading, ordered module list, real links/buttons, decorative image alternatives and hidden decorative SVG. Touch controls are at least 44px. Important content is always readable. Focus, keyboard dialog behavior, reduced motion, no-JavaScript content and document overflow were verified. Axe WCAG 2.1 A/AA scans passed for the section across the requested Chromium viewport projects; the existing whole-homepage accessibility suite also passed. Automated scans complement the keyboard and visual checks and do not establish universal conformance on every device.

## 13. Performance impact

No dependencies, video, canvas, WebGL, physics engine, large motion library or backdrop-filter surfaces were added. Five thumbnails use local responsive Next Image delivery, lazy loading and reserved media dimensions. Three assets are reused unchanged; the two new 768×512 WebPs total 94,316 source bytes before responsive optimization. Event work is scoped to the section, native carousel scrolling is passive and frame-coalesced, and observers/listeners/queued frames are cleaned up. No field Web Vitals or device performance benchmark was performed.

The new assets are [entrepreneurship](../public/images/entrepreneurship.webp) and [professional counselling](../public/images/counsellor.webp). Their full final generation prompts and provenance are recorded in [ASSETS.md](ASSETS.md).

## 14. Tests and checks actually executed

Final implementation validation passed:

- `npm run typecheck`
- `npm run lint` — zero warnings
- `npm run format:check`
- `npm run build` — production build and static homepage prerender completed
- `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm test` — **127 passed, 5 intentionally skipped**, across six Chromium viewport projects

The five skips cover three existing mobile-navigation cases outside the mobile layout and two carousel cases at orbital desktop widths. An earlier focused module-only run passed 28 tests with two desktop carousel skips; the final full run includes all module tests and the final interaction cleanup guard.

Coverage includes exact seven-module content, distinct local thumbnails, responsive geometry, no overlap or document overflow, hover/reset, real keyboard focus, bounded gaze direction, independent Hero gaze, availability dialogs, Coming Soon semantics, actual native touch swipes, all carousel positions, pause/resume, reduced motion, no-JavaScript fallback and axe scans.

Source hashes confirm the protected components remain unchanged. The [Hero screenshot comparison](reviews/r3/hero-regression.json) against the previous cap-placement review found 28 differing pixels out of 1,275,840, with a maximum channel delta of 3/255: tiny antialiasing variation, with no material rendering change.

## 15. Owner-review screenshots

All six requested widths and the interaction states below were captured from the production preview and visually inspected. No card overlap, clipped text or document-level horizontal overflow was found.

| Review state                    | Screenshot                                                                |
| ------------------------------- | ------------------------------------------------------------------------- |
| Desktop default — 1440          | [Default](reviews/r3/default-1440.png)                                    |
| Desktop default — 1920          | [Wide desktop](reviews/r3/default-1920.png)                               |
| AI Career Counselling hover     | [Violet focus and upper-left gaze](reviews/r3/ai-career-hover.png)        |
| CareerIgnite hover              | [Gold focus and upper-right gaze](reviews/r3/careerignite-hover.png)      |
| Career Counsellor Program hover | [Blue/violet focus and lower-right gaze](reviews/r3/counsellor-hover.png) |
| Keyboard focus                  | [Visible focus, card and path activation](reviews/r3/keyboard-focus.png)  |
| Tablet — 1024                   | [Tablet discovery rail](reviews/r3/default-1024.png)                      |
| Tablet — 768                    | [Narrow tablet](reviews/r3/default-768.png)                               |
| Mobile default — 390            | [Mobile discovery](reviews/r3/default-390.png)                            |
| Mobile default — 320            | [Small mobile](reviews/r3/default-320.png)                                |
| Mobile active module — 390      | [AI card selected](reviews/r3/mobile-active-module.png)                   |
| Reduced-motion desktop          | [Static complete composition](reviews/r3/reduced-motion-1440.png)         |
| Menti gaze detail               | [Magnified upper-left gaze](reviews/r3/menti-gaze-detail.png)             |
| Hero regression evidence        | [Preserved Hero rendering](reviews/r3/hero-regression-1440.png)           |

Geometry and gaze observations are recorded in [review-observations.json](reviews/r3/review-observations.json).

## 16. Remaining limitations and owner review

- The two new generated thumbnails are illustrative campaign scenes. Owner review should approve their brand fit or replace them with approved production photography; they make no participant or outcome claims.
- Existing story destinations and availability notices are retained. R3 does not add enrollment, operational AI, platform routes or backend functionality.
- Validation used Chromium at the six required widths, including emulated native touch input. Safari, Firefox, physical devices and field Web Vitals were not verified.

Implementation stops at R3. No other homepage section or platform surface was redesigned.
