# MentoraLM engineering constitution

These rules apply to all work in this repository. Read this file and the relevant documents in `docs/` before changing files. Explicit owner instructions govern the requested scope; surface material conflicts rather than silently changing established decisions.

## Product and current scope

MentoraLM is one unified platform with four surfaces: Main Public Website, Student Dashboard / Portal, LMS, and Admin Console. Main Public Website is the first implementation priority. Dashboard, LMS, and Admin are future phases unless explicitly requested. W1/W2 now authorizes the public frontend foundation, design system, navigation, homepage, footer, motion, and validation. Additional public pages and all future platform systems remain outside this phase.

The eventual principle is **one MentoraLM account** across Website → Dashboard → LMS. Administrators share the identity infrastructure with separate roles and permissions. Existing MentoraLM sites are not architectural precedent for this fresh implementation.

## Scope control

- Implement only the requested task; never silently expand scope or implement future phases early.
- Do not redesign unrelated systems while completing a task.
- Identify ambiguity that materially affects architecture; do not invent business rules.
- Technology selection requires deliberate approval. Do not initialize frameworks, databases, ORMs, identity providers, cloud services, or deployment platforms based on popularity or these documents alone.

## Architectural discipline

- Preserve clear domain boundaries and explicit ownership of shared functionality.
- Keep business rules outside UI and presentation components.
- Separate website presentation from learning and operational domains; avoid unnecessary coupling between surfaces.
- Prefer a modular architecture that can evolve. Avoid premature microservices and unnecessary distributed-system complexity.
- Preserve future sharing of identity, backend services, database infrastructure, storage, authorization, and domain models. Sharing infrastructure does not erase domain ownership.

## Security

- Client-side hiding is never authorization. Enforce authorization on the server when protected functionality is implemented.
- Every protected resource must verify ownership or permission. Prevent cross-student access and insecure direct object reference (IDOR) vulnerabilities, including when identifiers are guessed or changed.
- Never expose secrets in client bundles or hardcode production credentials.
- Validate untrusted input at trust boundaries.
- Sensitive admin mutations must be auditable when implemented.

## Database — when implementation begins

- Schema changes require migrations. Destructive schema changes require explicit approval.
- Define ownership and relationships explicitly; add appropriate constraints and intentional indexes.
- Do not duplicate domain state unnecessarily.

## API — when implementation begins

- Authenticate protected endpoints and authorize protected actions.
- Validate input and return structured errors without exposing internal implementation details.
- Do not silently break established API contracts.

## LMS — when implementation begins

- Program and Course are separate concepts. The learning hierarchy is Program → Course → Section → Lesson; exact relationships require later domain design.
- Learning progress belongs to the learning domain. Dashboard may display it but must not be its source of truth.
- Enrollment controls learning access; do not invent enrollment lifecycle or access policy.
- Assessment attempts and answers must preserve historical integrity.
- Published learning content must eventually support safe versioning.

## Admin — when implementation begins

- Admin is a control plane, not merely another UI. Backend permissions protect every admin action.
- Sensitive mutations must produce audit events.
- Roles should evolve toward granular permissions rather than one universal admin role.

## Testing

- Important business rules, authorization, cross-user access, and enrollment lifecycle require tests when implemented.
- Learning progress and assessment scoring require tests when implemented.
- Include regression tests for bug fixes when practical.
- Run validation appropriate to the change. Documentation-only work requires consistency and scope review, not invented application test results.

## Dependencies and code quality

- Add dependencies only for concrete reasons; prefer maintained, well-supported packages.
- Avoid capabilities duplicated by the approved stack. Explain significant new infrastructure dependencies.
- TypeScript is selected for the public frontend; keep it strongly typed; avoid `any` without a documented reason. See ADR-008 for the selected frontend stack.
- Prefer small composable modules; avoid giant components and service files.
- Prefer explicit code over clever abstractions. Introduce abstractions only for actual recurring problems.

## Change safety

Before modifying existing code:

1. Inspect relevant files and instructions.
2. Understand current behavior.
3. Identify affected boundaries.
4. Make the smallest coherent change.
5. Run relevant validation and tests.
6. Report what changed and what was verified.

Never claim tests passed unless executed. Keep confirmed decisions separate from proposals and assumptions in `docs/DECISIONS.md`. Update relevant documentation when an approved change affects it; do not silently override an accepted ADR.
