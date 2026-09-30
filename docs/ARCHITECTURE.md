# Unified-platform architecture

## Confirmed direction

MentoraLM is one platform with multiple product surfaces and an eventual unified identity model. Website is first; Dashboard, LMS, and Admin remain deferred unless explicitly requested. The W1/W2 public frontend selection is recorded below; deployment topology and future domain infrastructure remain undecided.

Prefer a modular architecture with explicit boundaries over premature microservices. Modules can share infrastructure while preserving ownership and contracts; separate services are not required for separate responsibilities.

## Conceptual boundaries

| Boundary                       | Responsibility                                                        | Interaction principle                                            |
| ------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Public website presentation    | Public content, discovery, journey entry points                       | Consume approved contracts; do not reach into learning internals |
| Student Dashboard presentation | Student overview and navigation                                       | Display domain-owned state; do not become its source of truth    |
| Learning domain / LMS          | Content, progress, assessments, learning outcomes                     | Own learning state and expose deliberate contracts               |
| Operational domains            | Applications, enrollment, student operations                          | Assign exact ownership and lifecycle in later domain design      |
| Admin control plane            | Authorized management operations                                      | Invoke domain operations through backend permission checks       |
| Shared platform capabilities   | Identity, authorization, storage, backend and database infrastructure | Assign explicit owners and interfaces when designed              |

This is a responsibility map, not a package layout, service list, database schema, or permission model.

## Dependency and state rules

- Business rules belong to domains, outside presentation components.
- Public program information must not require website code to access private learning tables or internal progress models. Design public contracts when implementation is authorized.
- Dashboard may display learning progress from the learning domain, but must not maintain an independent authoritative progress record.
- Enrollment controls learning access. Its lifecycle and relationships require explicit design; no status rules are assumed here.
- Program and Course are distinct concepts in Program → Course → Section → Lesson. Cardinalities and reuse rules remain undecided.
- Identity can be shared across surfaces while authorization differs by action, resource, and ownership.
- Shared database or storage infrastructure must not grant unrestricted access across domains. Avoid unnecessary state duplication.

## Evolution and decisions still required

The public frontend stack is now selected. Choose hosting, identity integration, data/storage approach, future domain module layout, and operating model deliberately when authorized. Preserve room for later integrations without building speculative infrastructure today. Record approved choices in [Decisions](DECISIONS.md); apply [Security](SECURITY.md) at each trust boundary.

## W1/W2 frontend implementation

Next.js 16 App Router with React 19 and strict TypeScript renders the public homepage as static prerendered HTML. Next.js was chosen for public rendering, metadata, image optimization, reusable React composition, and room for future API/authenticated integration. A client-only Vite SPA would require additional public-rendering/SEO plumbing; an HTML-only implementation would give up the component and type foundation requested for the evolving platform. No future backend or authentication architecture is implied. See the [official rendering documentation](https://nextjs.org/docs/app/getting-started/server-and-client-components).

`src/app` composes the page and metadata. `src/components/home` owns narrative sections; layout, navigation, program, motion, and UI components have separate responsibilities. `src/content/programs.ts` owns the seven editorial module positions. `src/content/home.ts` owns shared navigation, journey content, opportunity categories, and future-feature notices. `src/lib/site.ts` validates the optional approved public origin. CSS tokens and shared styles live in `src/styles`. Assets are local under `public`.

Presentation is server-rendered by default. Navigation, native notice dialogs, the reveal observer, and the R2 hero's small motion interaction wrapper are client components. Their state is transient UI state; it is not identity, authorization, enrollment, or learning state. Navbar accepts an account-actions presentation slot for later integration, without inventing an authenticated user model. No API routes, Server Actions, persistence, CMS, ORM, or identity provider were added.

R2 keeps hero editorial content, local imagery, capability links, Menti SVG, and decorative pathways in server components under `components/home/hero` and `components/menti`. `HeroExperience` receives those rendered children and owns only pause state, the reduced-motion subscription, and throttled fine-pointer eye movement. Menti is reusable presentation, not an AI service, identity symbol, or authenticated product integration. Hero CSS is scoped to its own composition; shared navigation and other homepage sections remain unchanged.

The subsequent Menti depth/blink correction adds `MentiInteraction`, a small client button receiving the server-rendered SVG as children. It owns only the explicitly requested blink, using the browser's Web Animations API on the existing eye group. A new activation cancels the previous effect; completion and unmount release it. No interaction state, timers, additional dependencies or character geometry move into the client component. Its button remains disabled until hydration, keeping the static character visible without JavaScript. It adds no AI or dialog functionality.

## R3 module ecosystem

`Ecosystem` now delegates to server-rendered `home/modules/ModuleEcosystem`. It composes the centered section heading, the exact existing `Menti`, decorative `ModuleOrbit`, and seven `ModuleCard` instances from `content/programs.ts`. That existing content model gains local thumbnail metadata for its featured variant; module definitions, statuses and destinations stay centralized. `ModuleCard` uses existing story anchors and `NoticeButton` availability dialogs. Coming Soon positions have no action or invented route.

`ModuleExperience` receives server-rendered children and owns transient selection, carousel position and an independent Menti pause control. Hover, focus, touch and native horizontal scrolling select a card. `menti/gaze.ts` converts character-to-card centers into the existing 2.4px horizontal / 1.8px vertical limits, writing the same inherited CSS variables used by `MentiEyes`. No alternative eyes, mascot, artwork, costume or expression implementation is added. The Hero interaction wrapper and every existing Menti file remain unchanged.

Desktop uses percentage-based card positions and an SVG orbit. At 1100px and below the same ordered list becomes a user-controlled scroll-snap rail, with two cards and a preview on tablet or one card and a preview on mobile. There is no automatic carousel rotation. A passive local scroll listener schedules at most one frame; a ResizeObserver updates target geometry when the rail or character changes size. Listeners, observers, queued frames and gaze are cleaned up. The existing page MotionObserver handles two reveal markers; no additional reveal observer is introduced.

Reduced motion resets eye movement and removes positional/thumbnail animation, retaining readable selection and path colors. No-JavaScript rendering uses the same seven cards in a grid/stack and hides enhanced controls; the Menti remains static. The CSS is isolated in `modules.css`. Existing Hero/Navbar, other homepage scenes, metadata, dependency files and platform boundaries are preserved. No API, persistence, authentication, library, canvas or WebGL is introduced.

### R3.1 compact composition

R3.1 preserves the server composition, centralized module data, exact Menti artwork, `ModuleExperience` gaze/selection logic and native carousel. `ModuleCard` now renders one whole-card anchor per featured module. Existing story fragments remain unchanged. The two availability pathways use an optional anchor trigger on the existing `NoticeButton`, retaining its native dialog and focus behavior; their real fragment destinations reveal section-local availability text without JavaScript or on modified-click navigation. Those fallback notices sit below the orbital stage, rather than inside positioned cards. The default button trigger and all existing callers remain unchanged. No nested interactive controls, new route, enrollment capability or dependency is introduced.

Desktop geometry is shortened in the existing orbit SVG and scoped stylesheet. Section-only Menti sizing is enlarged; original Menti, Hero, Navbar, content records, image files and carousel/gaze components remain untouched. Validation evidence is in `R3.1-VALIDATION.md`.

## R4 journey roadmap

The existing `Journey` entry point delegates to `home/journey/JourneySection`. Server components own six-stage editorial content, milestone markup, the code-native SVG route/landscape and `JourneyMentiGuide`. The existing `content/home.ts` journey record is updated to the approved six stages; other exports remain unchanged. Existing page order and all other section implementations remain intact.

`JourneyExperience` receives the server-rendered composition. It owns only local hover, focus, toggle emphasis and an independent pause control. Milestone buttons become available after hydration and expose selection with `aria-pressed`; this is visual emphasis, not saved progress or an onboarding flow. A section-local ResizeObserver retargets the exact existing Menti pupils through the existing bounded `mentiGazeToward` helper. Observer subscriptions and eye variables are cleaned up; reduced motion and pause reset gaze. Menti source and default rendering are unchanged.

`journey.css` scopes the airy environment, rising six-column desktop route, three-column tablet route with a row-return connection, and vertical mobile journey. The existing page MotionObserver handles heading/guide reveals. No JavaScript means readable static content, a static character and disabled enhancement controls. No new runtime dependency, raster asset, API, route, persistence or assistant service is introduced. Validation and owner evidence are recorded in `R4-VALIDATION.md`.
