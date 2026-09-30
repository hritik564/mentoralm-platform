# Design-system foundation

## R3 orbital module discovery

`Reference/Modules.png` is the approved composition reference, inspected before implementation. R3 applies only to the ecosystem section. A centered editorial heading, concise supporting line, one central instance of the existing Menti and seven surrounding paths replace the original pastel tiles. The navy scene uses restrained fixed stars, four fine concentric orbit lines, seven connections, small nodes and one gold accent. No part of the reference is flattened into the page; no character artwork is duplicated.

At desktop widths, GradLM sits above Menti, AI Career Counselling and CareerIgnite balance the upper sides, Entrepreneurship and Career Counsellor Program occupy the lower sides, and the two Coming Soon cards finish the lower ring. Percent-based horizontal centers and a bounded scene keep geometry deliberate. Card thumbnails, short existing positioning copy, numbered/icon identity and an always-visible action make discovery readable before interaction. Module accent families are blue, violet/magenta, orange/gold, cyan/teal, violet/blue and restrained neutral respectively.

Active cards gain a darker surface, modest accent edge/depth, more saturated imagery and a brighter connecting path/node. Fine-pointer hover adds a 5px lift and 4.5% thumbnail scale. Keyboard focus receives the same selection and a visible gold outline; the arrow responds without hiding essential content. Menti uses its existing pupil group and inherited gaze variables to look toward the selected card center, with a scoped 240ms return/target interpolation and the original 2.4px / 1.8px limits. Desktop returns to neutral when hover/focus leaves. Menti floats/blinks only through its existing finite CSS animations; an independent pause control stops its ambient motion and transitions. The Hero remains unchanged.

Tablet at 1100px and below moves Menti above a rail showing two generous cards and part of the next. At 640px and below, one main card and a next-card preview replace the orbit. Native scroll snapping, swipe, keyboard focus and previous/next controls update the selected card and gaze. A small connector takes the current module's accent. No carousel auto-rotation, page scroll-jacking or unexpected layout expansion is used. Coming Soon positions are readable, locked informational cards without navigation; they can be revealed by carousel controls. Without JavaScript, the cards become a grid/vertical stack and enhanced controls are hidden.

Reduced motion disables floating, automatic blinking, gaze, positional hover and thumbnail zoom. Static selected-card/path colors and keyboard focus remain. Orbit SVGs and thumbnails are decorative; section headings, ordered discovery list, named actions, 44px targets, live carousel position and existing honest dialogs provide semantics. Cards use near-opaque shaded fills without backdrop-filter. Five distinct local thumbnails are lazy-loaded with reserved media dimensions through Next Image; two new fictional editorial assets are documented in `ASSETS.md`. Validation and owner screenshots are recorded in `R3-VALIDATION.md`.

## R2 cinematic hero

`Reference/hero-desktop-approved.png` and `Reference/hero-mobile-approved.png` are the strongest hero composition references. R2 replaces only the opening scene. The approved R1 navigation, shared tokens, remaining homepage sections, official identity and content models are preserved.

The three-line DM Sans display gives only “a Guess.” the Newsreader italic treatment. Clear program discovery and the honest upcoming Menti action precede the visual detail. The existing local learner photograph sits in a curved frame, with four contrast-safe `GlassSurface` capability links, thin connected SVG paths, a small reusable star guide and an abstract global horizon. Capability links point to existing editorial sections. Horizon labels are decorative ecosystem concepts, with a visible development disclosure, rather than live listings.

Desktop uses two balanced areas; 1024px retains the layered composition at a smaller scale. Portrait tablet separates a two-column editorial area from a centered visual scene. Mobile follows text → CTAs → smaller Menti → learner → a readable two-column capability grid. Cards avoid the learner’s face and essential controls. Mobile reduces three pathway arcs to one and removes horizon labels.

Entrances use 400ms opacity/translation with delays up to 400ms; headline and actions finish within about half a second. Menti breathes for three six-second cycles and blinks for four five-second cycles. The single path highlight runs three nine-second cycles; the ambient field runs two fourteen-second cycles. Pause motion stops animations and tracking immediately; Resume motion restarts them. Fine mouse pointers move pupils by at most 2.4px horizontally and 1.8px vertically, throttled to roughly twelve updates per second with at most one pending frame. Meet Menti hover/focus emphasizes the speech and directs the pupils toward the CTA. No scroll animation or parallax subscription is added.

Reduced motion produces a complete static scene, disables tracking and positional feedback, and hides the irrelevant motion control. Without JavaScript, motion and its control are disabled while content, images and links remain available. Capability surfaces use no backdrop filter; only the small speech bubble uses an 8px blur. Menti’s size and four body-gradient colors accept CSS variables for reuse. Its SVG has unique gradient IDs and is decorative by default because adjacent text explains the upcoming guide. It can opt into a descriptive image role elsewhere. No new imagery, font, application package, canvas, video or animation framework is added.

## R2.1 hero art direction

R2.1 preserves the R2 content, architecture, responsive breakpoints, semantics and interaction logic. `Reference/Menti.png` now governs the character design. Menti's body, face and cap are separate server-rendered SVG layers with unique gradient IDs; the default expression remains a friendly smile, and the original pupil/blink hooks remain intact. Layered gradients, small internal highlights, sparse fixed spark detail and a modest rim glow give the rounded star depth without a raster asset or filter-heavy render. Graduation-cap facets and a gold star tassel integrate with the star's upper point.

Hero Menti widths increase from 124 to 160px on desktop, 102 to 132px on landscape tablet and 96 to 124px on mobile; narrow mobile uses 120px to preserve breathing room. The desktop dock bridges the learner and horizon, with adjusted vertical clearance. Mobile retains its existing narrative and card grid. Speech uses softer asymmetric geometry and a small pointer toward Menti. Its copy still describes an upcoming guide. Hover and keyboard focus share speech emphasis, a slight 3px dock response, brightness and a small glance; reduced motion suppresses the positional response.

The existing photograph receives a thin cyan/violet gradient rim, layered frame and restrained atmospheric edge blending without altering the image or covering the face. Near-opaque capability surfaces gain a shaded inner highlight, clearer edges, stronger icons and semibold titles; links and destinations remain identical. Intelligence arcs gain a faint broad aura and a static bridge toward the horizon, with the original single finite moving highlight. Mobile hides the bridge and retains only its reduced orbital detail. The horizon replaces its grid and angular connections with faint curved land silhouettes, fixed city lights and a few opportunity arcs. All labels remain conceptual. Primary CTA polish uses a light surface with subtle cyan/violet light; Meet Menti remains quieter dark glass.

No new JavaScript interaction, animation timer, package, font, raster asset, large-area blur, canvas or WebGL is added. Menti's float remains finite and is slightly gentler. Existing pause/resume, preference changes, no-JavaScript fallback, dialog focus lifecycle and decorative aria treatment remain unchanged. Review artifacts and executed checks are recorded in `R2.1-VALIDATION.md`.

## Menti depth and activation correction

The owner-requested follow-up deepens only Menti. Directional cyan/violet lighting, a darker underside, a soft central facial light, tapered glossy reflections and a bounded SVG inner bevel make the rounded star read as a curved form. Radial eye whites and soft sockets add eye depth; the cap gains a thin shaded front edge. The silhouette, size, default smile, pupil hooks and other hero layers remain unchanged. The bevel uses one small SourceAlpha blur shared by light and shade composites, constrained to the character rather than the hero.

Menti is now inside a native button named “Make Menti blink,” with a visible gold keyboard focus ring. Click, tap, Enter and Space trigger one 280ms close/open gesture; repeated activation restarts it. Reduced motion shortens this explicitly requested gesture to 120ms. Ambient pause continues to stop floating, automatic blinking, paths and tracking; it does not prevent a deliberate click response. Idle reduced-motion rendering remains static. The SVG itself remains decorative and server-rendered; adjacent text and the existing availability dialog continue to describe Menti as upcoming. No JavaScript leaves the button disabled without hiding the character. Review evidence and executed checks are in `MENTI-DEPTH-BLINK-VALIDATION.md`.

The subsequent cap-placement correction renders the cap after the body and face. Its crown band now covers the upper star point so it visibly rests on Menti's head. The cap geometry, character size, face and interaction hooks remain unchanged. Evidence is recorded in `MENTI-CAP-VALIDATION.md`.

## Visual thesis

An editorial education platform: intelligent and human, with navy immersive sections and warm light spaces for discovery. The supplied logo is authoritative. Cyan/blue and violet carry digital intelligence; magenta remains primarily within the official identity; orange/gold mark career momentum and small moments of possibility. The homepage avoids an all-over rainbow gradient. The supplied concept guides the direction, without copying its layout, additional routes, invented metrics, or testimonials.

## Tokens and typography

`src/styles/tokens.css` defines colors, muted/contrast-safe text, module washes, typography, spacing, section rhythm, container width, gutters, radii, shadows, motion durations, stagger delays, and easing. `src/styles/global.css` composes those tokens into responsive presentation. Brand-like lighter colors are decorative or used on dark surfaces; readable blue/orange accents are darkened for small-text contrast.

DM Sans handles UI, navigation, headings, and body. Newsreader italic is reserved for emotional emphasis in major headings and captions. Both are bundled through Fontsource rather than fetched at runtime from a font host. System fallbacks are provided. Fluid headings, gutters, and section spacing retain the narrative across widths.

## Reusable presentation

- `Brand`: faithful CSS crops of the supplied JPEG symbol and wordmark. No substitute logo or replacement lettering. A dark lockup protects the source’s white wordmark on light navigation.
- `Icon`: small local SVG primitives for interface symbols; they do not replace the brand.
- `ButtonLink`: consistent anchor variants with restrained arrow response.
- `NoticeButton`: native modal availability notice with accessible title/description, initial focus, explicit Tab wrapping, Escape closing, return focus, and no submission.
- `Navbar`: floating glass desktop navigation and mobile disclosure with expanded state, focus containment, Escape focus restoration, backdrop dismissal, background scroll locking, and breakpoint cleanup. The disclosure is navigation, not an ARIA application menu. A no-JavaScript navigation fallback remains available.
- `ProgramCard`: one model for five featured and two Coming Soon positions. Responsive editorial grid; only featured entries have actions.
- `Footer`: program discovery, opportunities/resources/company navigation, support and policy notices, and visibly pending social channels.

## Motion

A single `MotionObserver` progressively enhances `[data-reveal]` elements below the initial viewport. Elements fade and translate 18px into place once. Small groups stagger via shared tokens. Content is visible in server HTML, without JavaScript, or without IntersectionObserver. Changing reduced-motion preference resets pending elements immediately.

R2 replaces the original hero motion with the cinematic sequence described below. Motion does not run continuously forever. Below the hero, program cards lift by 5px, decorative art shifts slightly, arrows move, and editorial imagery scales by 3.5% on capable hover devices. Hover effects are enhancement, never required for access.

Transforms and opacity drive movement; surface/border feedback remains small. There are no particles, scroll handlers for parallax, scroll-jacking, fake counters, animation libraries, or blocked interactions. Dark/light transitions use intentional content and surface rhythm, plus section entry reveals, rather than animating page layout or backgrounds on every scroll event. `prefers-reduced-motion` removes transitions and animation and restores normal native scrolling.

## Responsive and accessibility foundation

The shared container caps reading width. Desktop columns become deliberate mobile stacks; the ecosystem retains full-width active cards and distinct Coming Soon positions. Journey becomes a two-column progression on mobile. Footer, editorial layouts, CTAs, and mobile navigation adapt independently. Primary touch controls are at least 44px tall.

Semantic header/navigation/main/section/article/ordered-list/footer landmarks, one page H1, logical section headings, descriptive image alternatives, decorative SVG hiding, a skip link, visible focus styles, and native dialogs/disclosures are present. WCAG A/AA axe scans and keyboard interaction tests supplement visual review. Automated checks do not establish full accessibility certification.

## Review boundaries

Colors, type pairing, imagery, copy, and official-logo treatment are the first implementation direction for owner evaluation. Changing them should preserve the shared tokens, accessible contrast, performance, and original brand assets. Later pages should reuse this foundation within an explicitly requested task.

## R1 visual foundation and navigation

R1 refines the global system and header only. `Reference/mentoralm-approved-visual-direction.png` is the strongest current art-direction reference; the original JPEG remains the authoritative logo. R1.1 refines the header into one generous rounded rail, with a light Modules pill, unboxed secondary links and one cyan-to-violet Login / Sign up action. The dark surrounding strip connects visually with the existing hero; the hero composition and all other scenes retain their W1/W2 implementation.

### Semantic tokens and typography roles

`tokens.css` now adds semantic background, deep/elevated surface, primary/secondary text, dark text, border and accent aliases. Cyan/violet carry emphasis; magenta/gold remain available for selective accents. Existing section tokens are retained to keep later section redesigns deliberate. Navigation sizing, focus geometry, glass radii, blur, shadows, glow, layer ordering, motion and reading width also have named tokens.

DM Sans and Newsreader remain the two locally bundled families. Opt-in `.type-display`, `.type-heading`, `.type-body`, `.type-label`, `.type-metadata`, `.type-cta` and `.type-editorial` roles in `foundation.css` establish a stronger future hierarchy: tighter, heavier editorial displays; calm headings; open body leading; tracked uppercase labels; quiet metadata; compact semibold actions. Editorial serif is for occasional emotional emphasis. Existing homepage heading sizes/compositions remain unchanged during R1; new type roles are adopted section by section. Navigation immediately uses the refined CTA/tracking hierarchy.

### Glass and atmosphere

`GlassSurface` accepts `tone="dark" | "light" | "elevated"` and optional `interactive`. It uses a stable 94–97% opaque fill, one 12px blur, a fine border, inner highlight and restrained shadow. Text colors are paired with the surface, including secondary text. Interactive styling is visual only: use semantic links/buttons for actions. `.glow-action` extends the existing `ButtonLink` with a contrast-safe deep cyan/violet gradient and opacity-driven hover glow. White text is preserved across the gradient; bright cyan remains primarily a border/focus accent.

`AmbientField` supplies optional static radial fields, faint stars and an orbital line. It is decorative, hidden from assistive technology and pointer events. Its parent must be positioned and isolated. It is intentionally not applied to existing homepage sections. Future scenes should use it selectively rather than stacking blur or decoration. `prefers-reduced-transparency` replaces glass with opaque surfaces and removes blur. The high-opacity base also remains readable when blur is unsupported.

### Header and mobile behavior

`Navbar` composes `DesktopNav`, `MobileNav`, and `NavActions`; the account action slot remains presentation-only. `tone` explicitly selects dark, light or elevated appearance. No section tracking is introduced. Modules is now an accessible disclosure containing all seven entries from the existing program content model. Five featured entries link to existing stories or the ecosystem; two planned entries retain their Coming soon status without invented destinations. The shared desktop/mobile dropdown supports expanded/controls state, Escape return focus, outside dismissal and desktop focus-leave closing. The mobile list remains expanded while moving among sibling navigation links, avoiding layout movement during clicks; closing the mobile menu resets the disclosure. Its Escape handler closes the inner disclosure before the mobile navigation. No new routes or module content are introduced.

A passive scroll subscription switches at 24px. The fixed header footprint remains stable; the desktop rail gently compresses from 72px to 64px inside the stable 88px header footprint, and the logo scales to 96%. Only the small rail changes height; document content does not move. Mobile retains its 58px frame. The default dark tone becomes slightly more opaque when scrolled. Reduced motion retains full rail height and removes size/scale transitions.

Below 960px, a large-target menu opens under the frame. Expanded/controls labels, Escape return focus, backdrop dismissal, Tab wrapping within the header, background `inert`, body scroll locking and desktop breakpoint cleanup keep the disclosure usable. It remains navigation, not an ARIA application menu. Login / Sign up opens the existing native availability dialog; its Escape/focus lifecycle takes priority and returns to Login within the open navigation. Selecting an anchor closes the disclosure and releases background state. Overflow is constrained by the dynamic viewport and can scroll vertically. The no-JavaScript navigation remains in normal flow.

### Motion and performance

`Reveal` wraps the existing single page-level `MotionObserver` with fade/scale variants and three small stagger choices. SSR/no-JavaScript content is visible; reduced motion clears pending reveals. Do not introduce another observer for every wrapper. Glass hover lift, CTA arrows/glow and the mobile menu entry use short transform/opacity transitions. Underlines use transform; reduced motion retains static feedback. The ambient primitive is static, requiring no animation loop.

R1 adds no font family, image, application dependency, canvas, WebGL, video or animation library. The header has one blur layer; the mobile panel has a near-opaque fill without another backdrop filter. Visible focus, readable surface pairings and 44px controls are required in every variant. Automated axe checks supplement keyboard and visual review; they are not a complete accessibility certification. Field Core Web Vitals and Safari/device review remain release checks.

### R1.1 composition reference

`Reference/Masai .png` was inspected for unified rail composition only. No Masai branding, colors, dimensions, content or code are used. The navbar removes the center-link border/background and the separate logo backing. Modules and the single authentication action provide selective emphasis. Equal desktop side tracks center the primary links within the rail while the logo and authentication action remain anchored to its edges. Mobile keeps its independent layout. Availability remains disclosed in the existing native dialog rather than a Coming soon line inside navigation. All homepage scenes remain unchanged.

R1.1 validation (2026-09-30): typecheck, lint, formatting and production build passed. The full six-width Chromium suite passed 63 tests with three intentional mobile-only skips at desktop widths, including axe, focus/keyboard, reduced-motion and stable-header checks. Desktop/tablet top and sticky states and mobile/narrow-mobile menus were visually inspected. A SHA-256 comparison confirmed all 23 protected homepage/content/layout/asset/dependency files unchanged. The bounded desktop rail height transition is contained inside the fixed header footprint; reduced motion retains the larger static rail. No additional dependency or section changes were made.

The subsequent navbar comment refinement centers the desktop links and renames Programs to Modules, with a seven-entry disclosure on desktop and mobile. Files affected: `src/components/navigation/DesktopNav.tsx`, `MobileNav.tsx`, `Navbar.tsx`, new `ModulesDropdown.tsx`, `src/styles/navigation.css`, `tests/home.spec.ts`, `tests/navigation.spec.ts`, and this document. Typecheck, lint, format check and production build passed; final Chromium suite: 69 passed, three intentional mobile-only skips at desktop widths. Dropdown axe/keyboard/Escape/outside-dismissal/destination checks passed at all six widths. Desktop and mobile screenshots were inspected. All 23 protected homepage/content/layout/asset/dependency files remain unchanged. An initial mobile click timing failure was corrected by keeping inline module content stable during sibling-link clicks and resetting it when the mobile menu closes.

## R3.1 compact ecosystem refinement

The existing orbital stage is reduced from 1060px to 630px. Desktop active cards use a 37% side thumbnail and compact text column, normally 300×180px; the Coming Soon pair uses approximately 258×170px. Titles stay 16px and positioning copy approximately 13px. Existing short labels replace long descriptions except the approved professional certification line. One whole-card link, one quiet arrow and no repeated Explore pathway row provide the scan hierarchy.

The centered eyebrow, 44.8px maximum title, short support line and 18px stage gap unite the composition. Desktop section padding is 32px; the section uses the existing document scroll-padding rather than an additional scroll-margin. Menti is 235px here, versus R3's 210px, with its redundant desktop caption omitted visually; tablet/mobile retain the caption. The same SVG geometry now connects to the compact positions, with default ring opacity 0.46 and path opacity 0.38, versus 0.30 and 0.25 previously. Selection remains 0.95. Fine-pointer hover lifts 3px and scales photographs 2.5%; whole-card focus has the existing gold outline, selection and gaze.

At 1100px and below, the existing 44%-width tablet rail remains; at 640px and below, the existing 86%-width mobile rail remains. Top thumbnail crops keep subjects legible in the narrower cards. Minimum heights become 264px tablet and 284px mobile, growing naturally for longer content. Menti sizes become 190px tablet and 162px mobile. User-controlled swiping, controls, next previews, no-JavaScript grid/stack, independent pause and reduced motion remain intact. No asset, font or dependency is added. See `R3.1-VALIDATION.md` for executed checks and review captures.

### R3.1 owner spacing correction

The desktop stage now uses the existing 1240px content width, versus the earlier 1120px stage, while keeping featured cards at 300×180px and Coming Soon cards capped at 258×170px. The upper side pair moves 20px upward to give the side rows a 50px vertical gap. At the full stage width, the bottom pair gains a 40px horizontal gap and the lower side-to-bottom separation increases to about 37px. The stage stays 630px tall, retaining the compact comparison view. Existing orbit coordinates follow the wider stage. Tablet/mobile rails, card content, Menti and all interactions remain unchanged.

### R3.1 connecting-thread clearance

The next owner comment moves desktop position 01 upward by 16px and positions 06/07 downward by 24px relative to the orbital stage. The heading gap increases by 8px to preserve supporting-copy clearance; the stage grows from 630px to 654px to contain the bottom cards and controls naturally. The three curved connections and their midpoint nodes follow the moved cards. Menti, the other four cards, card sizes and the tablet/mobile rail remain unchanged. At 1440×900 all seven pathway titles remain visible; 1440×1000 contains the complete card borders. The small increase in natural section height provides visible threads above and below Menti.
