# LMS Light / Dark theme pass

Presentation only. The approved LMS composition and density are retained. Prisma, migrations, Clerk, entitlement, enrollment, learning/academic services, API behavior, private media delivery and public website styling are unchanged. The Dashboard receives preference compatibility changes only; its design is unchanged. No deployment, push or Admin work.

## Shared architecture and persistence

The existing `DashboardTheme` context, binary theme type and Sun/Moon toggle are reused by both protected layouts. Both resolve their initial theme from the request cookie on the server, then initialize the same client provider with that value. There is no localStorage lookup or post-hydration theme swap. Missing/invalid preference preserves the prior defaults: LMS Dark and Dashboard Light. OS preference is not used; no third theme option is introduced.

Explicit selection writes `mentoralm-product-theme=light|dark`, with root Path, one-year Max-Age and SameSite=Lax; HTTPS adds Secure. The old `mentoralm-dashboard-theme` path-scoped cookie remains a read fallback on Dashboard. Opening Dashboard migrates it to the shared preference and removes the obsolete cookie. A direct first LMS visit cannot read a legacy cookie scoped to `/dashboard`; visit Dashboard once to migrate an existing legacy preference. New selections in either surface immediately persist for both.

This is a device/browser preference, not an account/database field. Clearing cookies resets it. No authentication/session cookie is modified. Public marketing pages never read this preference and never receive a product theme attribute.

## Production domains

Only HTTPS on the exact approved hosts `mentoralm.com` and `students.mentoralm.com` writes the preference with `Domain=mentoralm.com`. Localhost/IP/preview/other hosts use a host-only cookie, with no domain widening. Shared production theme state requires both approved HTTPS hosts to serve the same application with the already documented production origins; no additional secret or theme environment variable is needed. Verify real cross-subdomain handoff when those domains are deployed. Local validation checks same-host Dashboard/LMS navigation and the cookie-domain allowlist, not live production DNS/browser delivery.

## Visual implementation

The existing LMS styles now use scoped semantic palette variables with their original dark colors as fallbacks. The Light attribute supplies white surfaces, a pale cool-gray/lavender canvas, navy text, slate metadata, violet active accents, soft shadows and readable semantic badges. Dark geometry, density and original palette remain intact. Media itself is unchanged; owned player chrome, outline, controls, inputs, dialogs/drawers, loading/error/empty states and academic/discussion/certificate surfaces inherit the theme.

The 44px toggle sits beside the avatar, uses the existing accessible Dark mode name/pressed state, works with keyboard activation and inherits the LMS visible focus treatment. Mobile retains the two-row compact header and horizontally scrollable Learn tabs.

## Focused verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm run build
LMS_UI_OWNER=user_YOUR_EXISTING_DEVELOPMENT_ID npx playwright test --config=playwright.lms-theme.config.ts
```

An exact existing owner email is also supported. The test enforces the existing local development database guard, uses a temporary normal Clerk Development sign-in ticket/session and revokes them afterward. It creates no Clerk user and sends no email. A question-control check may start a new local Quiz draft only when the owner has no existing attempt; cleanup targets only that new owner's still-IN_PROGRESS attempt. Existing owner answers/submissions are never overwritten.

Coverage: all eleven Home/list/Player/assignment-detail/Quiz/Assessment views in both themes, both toggle directions, navigation/refresh persistence, server-rendered theme markup, Dashboard compatibility, legacy-cookie migration, public-page isolation, 1440/820/390 overflow, drawer Escape/focus return and representative WCAG AA axe scans including question controls. Exactly six captures are saved under ignored `docs/reviews/lms-theme/`: desktop Home Light/Dark, Lectures Light, Player Light; mobile Home Light and Player Light. They are opened and visually inspected. These are representative accessibility checks, not exhaustive assistive-technology certification. Populated issued Certificates and unavailable video playback are not fabricated or asserted.

## Executed results

| Check                              | Result                                |
| ---------------------------------- | ------------------------------------- |
| Typecheck                          | Passed                                |
| Lint                               | Passed, zero warnings                 |
| Format check                       | Passed                                |
| Production build                   | Passed                                |
| Focused theme browser test         | 1 passed (49.4s)                      |
| Representative WCAG AA axe checks  | Zero violations in scanned views      |
| Overflow checks                    | Passed at 1440, 820 and 390           |
| Visual review                      | All six prescribed captures inspected |
| Locked domain/auth/schema/API diff | Unchanged                             |

No historical L1–L4 suite was rerun; no business implementation was changed. Live production subdomain synchronization remains a deployment verification item.

## Files changed in this pass

- `src/lib/dashboard/theme.ts`
- `src/components/dashboard/theme/DashboardTheme.tsx`
- `src/app/dashboard/layout.tsx`
- `src/app/learn/layout.tsx`
- `src/components/lms/LmsShell.tsx`
- `src/styles/lms.css`
- `src/styles/lms-reset.css`
- `src/styles/lms-theme.css` (new)
- `playwright.lms-theme.config.ts` (new)
- `tests/lms-theme.spec.ts` (new)
- `docs/LMS-THEMES.md` (new)

Earlier LMS redesign and owner-seed modifications remain in the worktree; they are not new changes made by this theme pass.
