# Menti cap placement correction

The owner requested that Menti wear its cap on its head rather than behind it. The cap previously rendered before the body, allowing the star's upper point to cover the crown band and front of the cap.

`src/components/menti/Menti.tsx` now draws body → face → cap. The band covers the upper point and rests visibly on the head. Existing cap geometry, dimensional shading, sizing, speech, gaze tracking, click/tap/keyboard blinking, pause/resume and reduced motion are preserved. No additional filter, animation, asset or dependency was added.

Other files: `docs/DESIGN-SYSTEM.md`, this report, and review evidence under `docs/reviews/menti-cap-placement/`. A SHA-256 comparison confirms the other 56 source, asset and test files remain unchanged (`scope-verification.json`).

Validation executed:

- `npm run typecheck` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run format:check` — passed.
- `npm run build` — passed; homepage remains statically prerendered.
- `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/mentoralm-browsers npm test` — 99 passed, three intentional mobile-navigation-only skips at desktop widths. Existing blink, gaze, reduced-motion, accessibility and layout checks passed across all six viewport configurations.

Visually inspected the close-up and hero captures at 1440, 1024, 768, 390 and 320px. The cap sits in front of the upper point; eyes, brows, smile and speech remain clear. No horizontal overflow was observed. Screenshots and geometry observations are saved in the review directory. Owner review of the cap's appearance remains subjective; no physical-device or Safari certification is claimed.

Stop after this focused correction.
