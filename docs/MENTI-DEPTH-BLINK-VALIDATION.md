# Menti depth and click-to-blink correction

Owner request: give the existing hero Menti more 3D depth and make it blink on click. The authoritative `Reference/Menti.png` was inspected. This follow-up preserves the character's rounded silhouette, scale, expression, speech, gaze tracking and surrounding hero composition.

## Files changed

- `src/components/menti/MentiBody.tsx`: stronger directional shading, central volume, gloss, a small inner bevel and shaded underside.
- `src/components/menti/MentiEyes.tsx`: curved eye-white lighting and soft eye sockets, retaining the pupil and blink groups.
- `src/components/menti/MentiCap.tsx`: shaded front thickness on the existing graduation cap.
- `src/components/menti/MentiInteraction.tsx` (new): native button with a finite activation blink and cleanup.
- `src/components/home/hero/HeroVisual.tsx`: wrap the server-rendered character in the interaction button.
- `src/styles/menti.css`: transparent button styling and visible keyboard focus, preserving the dock footprint.
- `tests/hero.spec.ts`: regression coverage for activation, restart, keyboard, reduced motion, completion and no-JavaScript fallback.
- `docs/ARCHITECTURE.md`, `docs/DESIGN-SYSTEM.md`, this report and review artifacts.

## Behavior and accessibility

Click/tap, Enter and Space close then reopen both eyes. The button's accessible name is “Make Menti blink.” It retains focus after keyboard activation. Each activation cancels the previous blink rather than stacking effects. Completion and unmount remove the effect. The character remains a server-rendered decorative SVG with its existing adjacent explanatory text.

The gesture lasts 280ms normally, 120ms with reduced motion. User activation remains available while ambient motion is paused. Reduced-motion idle state has no animation or pupil tracking. Existing pause/resume and Meet Menti dialog checks passed. The button is disabled before hydration and without JavaScript; the character and speech remain visible. Its target exceeds 44px in both dimensions at all six tested widths.

## Checks executed

- `npm run typecheck` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run format:check` — passed.
- `npm run build` — passed; homepage remains statically prerendered.
- `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm test` — 99 passed, three intentional mobile-navigation-only skips at desktop widths; 102 tests across six Chromium configurations (320, 390, 768, 1024, 1440 and 1920px).
- Additional actual touchscreen `tap()` check at 390px with reduced motion — passed; one 120ms blink, closed eye scale 0.06.
- SHA-256 scope comparison — all 50 other source, asset and test files unchanged. Only the six listed existing implementation/test files changed; the interaction component was added. Evidence: `reviews/menti-depth-blink/scope-verification.json`.

## Visual review

Inspected rendered captures at 1440, 1024, 768, 390 and 320px. Menti retains its prior placement and size; eye/cap layers remain clear, the speech is readable, the learner's face remains visible and the existing mobile narrative flow is preserved. No horizontal overflow was observed. The detail, closed-eye and keyboard-focus captures were inspected, along with reduced-motion and Meet Menti reaction states.

Artifacts under `reviews/menti-depth-blink/`:

- `hero-1440.png`, `hero-1024.png`, `hero-768.png`, `hero-390.png`, `hero-320.png`.
- `menti-detail-3x.png`, `menti-click-blink.png`, `menti-keyboard-focus.png`.
- `meet-menti-focus.png`, `reduced-motion-1440.png`.
- `review-observations.json`, `scope-verification.json`.

## Performance and limits

No raster asset, package, font, backend, animation library, canvas or WebGL was added. The dimensional treatment uses native SVG gradients and one bounded filter with a single shared 3.5-unit alpha blur. Blink work starts only on activation; it uses a short transform animation with no timer or recurring loop. Existing ambient motion remains finite. No new performance benchmark or Safari/physical-device certification is claimed; owner review of the depth treatment remains subjective.

Navbar, hero copy, learner treatment, capability links, pathways, horizon, CTAs, and all other homepage sections remain unchanged. Stop after this correction.
