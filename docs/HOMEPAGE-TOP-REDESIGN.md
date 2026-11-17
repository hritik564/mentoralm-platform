# Public homepage top-section redesign

Implemented against `reference/homepage-hero-approved.png` (tracked-directory casing: `Reference/`). The reference was inspected before implementation. Its midnight hero composition, lead carousel and narrow next-program card, centered typographic hierarchy, perspective grid and lower waves were translated into real responsive UI. The existing public navbar is reused unchanged. The official MentoraLM logo remains authoritative; the concept image is not shipped as a page background.

## 1. Exact files changed

Only one pre-existing application file changed:

- `src/app/page.tsx` — compose the new public opening and homepage-specific metadata; all lower sections retain their existing imports/order.

New presentation components/data:

- `src/components/home/homepage/HomepageHero.tsx`
- `src/components/home/homepage/HomepageAtmosphere.tsx`
- `src/components/home/homepage/ProgramCarousel.tsx`
- `src/components/home/homepage/ProgramSlide.tsx`
- `src/components/home/homepage/HeroCTA.tsx`
- `src/components/home/homepage/programs.ts`

New styles/assets:

- `src/styles/homepage-hero.css`
- `public/images/homepage/careerignite.webp`
- `public/images/homepage/youngminds-ai-lab.webp`

New validation/report files:

- `playwright.homepage.config.ts` — isolated public presentation test configuration, not deployment configuration.
- `tests/homepage-redesign.spec.ts`
- `docs/HOMEPAGE-TOP-REDESIGN.md` — this report and image prompts.

Total: 13 implementation/test/report files. The owner-provided untracked reference image is an unchanged input, not generated implementation output. Next dev temporarily appended its standard AGENTS instructions and switched next-env type imports; those generated-only changes were cleaned up, preserving the original files.

## 2. Components and visual composition

`src/app/page.tsx` reuses the existing `Navbar` and official `Brand` unchanged. Its navigation remains Modules, Opportunities, Resources and About. Modules retains its existing seven-entry disclosure. The existing `Navbar` → `NavActions` → `WebsiteAccount` account tree remains intact: anonymous visitors use Login / Sign up and the existing `AuthSheet`; the existing signed-in branch renders `AccountMenu` and the account avatar. No navbar Get Started action or audience navigation was added. Shared navigation, account/authentication components and product shells are untouched. The restored signed-in account branch was verified with the existing owner Clerk Development account on desktop and mobile.

`HomepageHero` composes server-rendered slide content, code-native decorative grid/waves and `HeroCTA`. The small `ProgramCarousel` client owns only transient active-slide state. CSS selectors are scoped to the new homepage composition; existing brand tokens and lower-page styles are unchanged. Hero artwork is photography only; all navigation, copy, buttons, feature pills, cards, wireframe, light accents and layout are actual DOM/CSS/SVG elements.

At the 1672px reference width: carousel at y136px, lead card approximately1245×371 plus a narrow preview card; centered headline below. The public navbar retains its existing capsule layout rather than the reference's replacement navigation. Generated photography has its own crop/composition rather than reproducing reference people. The logo is the approved official asset rather than the concept's alternate symbol.

## 3. Carousel behavior

Exactly two slides: CareerIgnite and YoungMinds AI Lab, using the requested subtitles and feature pills. Manual cyclic previous/next buttons, bottom-center indicator buttons, desktop next-program preview and Left/Right keys while the carousel region is focused. No automatic rotation, timer or unexpected slide movement.

Transitions last480ms and respect prefers-reduced-motion. Inactive slides are visually hidden, aria-hidden and inert. Navigation controls keep focus and announce the selected program through a polite status region. Controls have accessible names and indicator pressed states. The current Next Image preload API preloads only the first lead artwork.

The reused mobile navigation retains its existing focus containment, Escape handling, background inertness/scroll-lock cleanup and trigger restoration. Account entry continues through the existing native `AuthSheet` dialog. Without JavaScript the first slide, program discovery/signup links and the original Navigation without JavaScript fallback remain available; enhanced carousel controls are hidden. The YoungMinds fragment fallback reveals an intentional availability notice without JavaScript.

## 4. Generated assets

Both are newly generated, text-free illustrative photography, not real student endorsements. Built-in `image_gen.imagegen` was used; no CLI/API-key fallback or external image hotlink. Outputs were visually inspected, then converted to WebP without changing artwork content.

| Project asset                                   | Dimensions | Bytes  |
| ----------------------------------------------- | ---------- | ------ |
| `public/images/homepage/careerignite.webp`      | 1672×941   | 62,638 |
| `public/images/homepage/youngminds-ai-lab.webp` | 1672×941   | 73,356 |

The pair shares navy clothing, a midnight/indigo environment and restrained violet/blue lighting. CareerIgnite features a young Indian adult with laptop/notebook on a campus at dusk. YoungMinds features a young Indian learner with laptop, friendly robot and subtle technology visualization. Final prompts and original generated-file paths are recorded below.

## 5. Responsive behavior

Desktop preserves the large lead card and narrow preview. The reused navbar keeps its original desktop layout and becomes its existing mobile disclosure below960px. The carousel drops its narrow preview below901px while retaining manual arrows and indicators. On phones the program copy and CTA appear above the photographic region; the headline/CTA stack beneath the carousel. Images cannot cover essential copy. Buttons, feature pills and headings remain readable at320px. Reduced motion preserves all actions without positional animation.

## 6. Validation

### Historical validation before navbar restoration

The following results were recorded before the navbar was restored. They verify the initial redesign and are not final validation of the restored navbar.

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run format:check` — reports existing formatting issues in four untouched files: `scripts/production/bootstrap-first-governor.ts`, `scripts/production/intent.ts`, `tests/production-p1.test.ts`, `tests/production-providers.test.ts`. Each matches the starting snapshot byte-for-byte. These protected P1 files were not changed. A scoped Prettier check of all homepage source/style/test/report files passed.
- `git diff --check` — passed.
- `npm run build` — passed; homepage prerendered as static public HTML.
- `npx playwright test --config=playwright.homepage.config.ts` — initial21/21 passed:11 new focused tests plus10 selected unchanged public regressions.
- `npx playwright test --config=playwright.homepage.config.ts --project=homepage` — final12/12 passed after adding the exact reference viewport and final typography/fallback refinements.
- Targeted final no-JavaScript rerun —1/1 passed, including non-overlapping fallback navigation and YoungMinds fragment content.

The pre-restoration runs covered22 unique passing tests across12 homepage checks and10 unchanged public regressions. Coverage includes exact program copy/destinations, exactly2 slides, keyboard/manual controls, no autorotation, focus restoration, nested mobile-menu/native dialogs, local assets/no missing assets, reduced motion, no-JavaScript rendering, SEO/server HTML, preserved Module/Journey and Opportunities interactions.

Both slides checked at1672×941,1440×1000,1024×1000,820×1000,390×844 and320×844: zero axe WCAG A/AA violations and no horizontal document overflow or clipped program copy. 24 pre-restoration screenshot files (full viewport and carousel crops) are preserved in ignored `docs/reviews/homepage-top/`, with `capture-manifest.json` and validation logs. Their navbar shows the initial redesign, not the restored final navigation. These public presentation captures use the local development preview; developer chrome is not part of production UI. Desktop/reference-size and mobile images were inspected visually.

Tests use only loopback3111 with process-scoped blank Clerk keys, leaving environment files/auth configuration unchanged. Browser safeguards reject external requests, API/protected/auth routes and mutations. CTA targets are inspected without authenticating. These public presentation runs did not exercise a live Clerk session, database or provider integration.

Existing tests that explicitly require the superseded cinematic Hero/Menti remain unmodified and are not represented as passing. The original `tests/navigation.spec.ts` now applies again because its Modules/Login navbar has been restored unchanged. The new homepage suite updates only its navbar-specific expectations and retains its carousel, hero, responsive and reduced-motion checks. The complete legacy public suite has not been claimed green.

### Current navbar-restoration validation

- `npm run typecheck` and `npm run lint` — passed.
- `npx playwright test --config=playwright.homepage.config.ts --project=homepage --project=restored-navbar-desktop --project=restored-navbar-mobile` — 17 passed, 1 intentional desktop skip for the mobile-only test. This covers all12 homepage cases and all5 applicable unchanged navigation cases. Both slides retain zero axe WCAG A/AA violations, no horizontal overflow and readable content at320,390,820,1024,1440 and1672px.
- `npx playwright test --config=.local/playwright.navbar-rollback-real.config.ts` — 2 passed, using the existing owner Clerk Development account in fresh desktop/mobile browser sessions. Verified actual profile avatar/identity, exact Dashboard and Support destinations, Log out, keyboard navigation and Escape focus restoration, mobile focus containment, and signed-out account entry after logout. Each run's new session was confirmed inactive; cleanup was restricted to that session. No user or business record was created, no business route was visited, and no database was queried. Test/config files remain ignored under `.local/`; auth traces/screenshots/video were disabled.
- Current public screenshots are preserved under ignored `docs/reviews/navbar-rollback/` (31 images and capture manifest). Desktop opening and mobile-menu screenshots were inspected visually.
- Hero components, carousel data, artwork and hero styles are byte-identical to the approved pre-rollback snapshot. Existing navigation/account/authentication components are also byte-identical. Only the homepage entry point reuses them again.
- `npm run build` — passed; the homepage remains prerendered static public HTML. Scoped Prettier and `git diff --check` — passed. The existing four unrelated global-format warnings listed above were not changed by this rollback.

## 7. Copy and destination limits

All requested visible hero copy is implemented. Hero Get Started Today uses the existing `/sign-up` destination through `websiteHref`; navbar account entry remains the original Login / Sign up action and existing signed-in account menu. CareerIgnite Explore Program goes to the existing `#story-careerignite` story; no new product-detail route was invented. Modules, Opportunities, Resources and About retain their original existing destinations.

YoungMinds does not yet have an approved dedicated public page or inquiry/enrollment flow. Its Explore Program action opens an honest availability notice and also has a functional fragment fallback. No fake application, signup, inquiry, upload or backend capability was added. Existing lower homepage content remains unchanged.

## 8. Scope confirmation

Student Dashboard/LMS and Admin behavior/source, authentication/Clerk configuration, environment files/secrets, database/Prisma/migrations, API/authorization/business logic, deployment/Replit/production-provider configuration and production scripts were not modified. Protected-source hashes match the starting snapshot. Shared public components were reused without modifying them. No Production connection or mutation, migration, provisioning, commit, push, publish or deployment occurred.

## Image generation prompts

# MentoraLM homepage artwork

Mode: built-in image_gen.imagegen. New image generation; reference inspected for visual direction only. No CLI fallback.

Both outputs inspected visually: 1672×941 PNG, text-free, midnight/indigo/purple palette, clear left copy space, subject on right.

## CareerIgnite

Output: /Users/hritikgupta/.codex/generated_images/01a1e925-9725-7152-bad8-9276e337202a/exec-1395e713-8b8e-4de4-b307-52c6c1207e5a.png

Final project asset: public/images/homepage/careerignite.webp

Final prompt:

Use case: photorealistic-natural.
Asset type: original wide landscape artwork for a premium MentoraLM education website carousel; this asset contains photography only, with real UI added separately by the website.
Primary request: a confident Indian woman aged 20–23, natural warm smile, navy casual hoodie with subtle backpack straps, holding a closed silver laptop and a simple notebook, looking upward toward her future. Modern university campus at blue-hour dusk behind her.
Composition/framing: 16:9 wide cinematic landscape. Woman occupies only the RIGHT third, visible from waist up, head with generous room above, complete laptop visible. LEFT 55% is clean deep black-midnight/navy negative space with only a faint out-of-focus campus silhouette, no foreground objects. A smooth photographic atmospheric gradient connects both halves. The image should crop cleanly into a wide rounded carousel.
Style/medium: highly polished premium editorial education photography, realistic skin texture, believable anatomy and natural expression, shallow depth of field. Aspirational and credible.
Lighting/mood: cool indigo and blue dusk, soft violet/magenta rim lighting, restrained warm highlights in distant campus windows, elegant premium futuristic atmosphere. Restrained soft lens bloom only.
Color palette: black-midnight navy, indigo, purple and blue, subtle muted dusk pink.
Constraints: render a NEW text-free photography asset, not a webpage or interface. Absolutely no words, letters, numbers, captions, logos, watermarks, buttons, panels, borders, cards, navigation, symbols or UI. No glowing rings or graphic ribbons, since those are live UI layers. No overly bright busy scenery on the left. No illustration, cartoon, gaming aesthetic, cyberpunk costume or exaggerated sci-fi.

## YoungMinds AI Lab

Output: /Users/hritikgupta/.codex/generated_images/01a1e925-9725-7152-bad8-9276e337202a/exec-731823a0-98e4-471c-a1a8-5d0e6ea7f120.png

Final project asset: public/images/homepage/youngminds-ai-lab.webp

Final prompt:

Use case: photorealistic-natural.
Asset type: original wide landscape artwork for a premium MentoraLM education website carousel; photography only with live website UI overlaid separately.
Primary request: an Indian young learner aged 12–14 exploring technology beside a sleek friendly compact white-and-indigo robot in a modern learning lab. The learner is curious and confident, wearing simple navy casual clothing, operating a clean laptop without visible writing. Robot has restrained gentle blue expressive eye lights on a dark face panel, credible well-designed robotics rather than a toy or gaming character. One subtle transparent holographic orbital visualization above the desk evokes AI discovery without containing text or numbers.
Composition/framing: 16:9 wide cinematic landscape. Learner and robot grouped on the RIGHT third/RIGHT 45%, waist-up learner and entire robot head/body visible. LEFT 55% is deep black-midnight/navy negative space with only faint defocused lab architecture, no foreground objects, clean room for real carousel copy. A soft atmospheric gradient connects the halves; crop-friendly wide rounded carousel composition.
Style/medium: highly polished premium editorial education photography, photorealistic human face/hands and materials, believable lab, natural expression, shallow depth of field. Aspirational, credible, warm intelligent education mood.
Lighting/mood: black-midnight, cool blue and indigo environment, soft violet/magenta rim lighting, delicate white technology highlights and muted blue practical lights. Consistent premium photographic lighting with a blue-hour university student campaign.
Constraints: a NEW text-free photography asset, not a webpage or UI mockup. Absolutely no words, letters, numbers, captions, logos, watermarks, buttons, panels, borders, cards, navigation or UI. No glowing rings or graphic ribbons. No cartoon, mascot illustration, bulky sci-fi armor, gaming, dystopian cyberpunk, excessive neon or busy bright scenery on the left.
