# LMS student entry

The LMS now has a dedicated account entry experience, using the existing Clerk provider and PostgreSQL User. This change creates no Prisma migration, identity store, entitlement, Batch membership, or Enrollment. Public website and Dashboard auth presentation are unchanged.

## Routes and flows

On `students.mentoralm.com`, `/sign-in` and `/sign-up` (including Clerk's nested verification/recovery routes) rewrite to the internal `/lms-auth` route tree. Local single-origin development uses `/lms-auth/sign-in` and `/lms-auth/sign-up`; `/learn` remains the local LMS root. Production internal auth aliases canonicalize to the native paths.

Signed-out root and deep links redirect directly to LMS sign-in. The proxy passes an internal-only `redirect_url`. After Clerk completes authentication, the form's forced destination returns to the server entry page, which resolves the existing MentoraLM User and checks business entitlement. Authorized users continue to the allowlisted learning destination, where normal Enrollment/resource authorization runs again. Existing sessions follow this same gate without displaying the form.

Raw external destinations are rejected, including absolute URLs on approved domains. Arrays, protocol-relative URLs, encoded paths, query strings, hashes, backslashes, traversal, and non-learning paths fall back to learning home. A rejected return receives concise student copy; the raw value is never reflected in UI. Forwarded hosts cannot select an auth destination.

An unentitled student sees an intentional access-unavailable state, Contact Support, Log out and optional Dashboard link. Contact Support opens the existing support-ticket composer and uses the already authorized authenticated student Support domain. It does not bypass the entitlement gate on native LMS Support/Profile pages or APIs and never unlocks learning. The composer preserves its existing default behavior for entitled Support users.

Clerk owns all credentials, verification, recovery, password handling, session cookies and error validation. Form settings preserve the existing instance's configured authentication methods. Signup resolves the same User with no implicit business access. Provisioning/identity lookup failures receive generic retry copy and no internal details. Expired/invalid sessions return to entry. If a verified Clerk identity lookup fails during an existing protected render, retry targets learning home; the normal signed-out deep-link flow preserves the original allowlisted path.

## Theme and accessibility

Auth reuses DashboardTheme and the server-read product theme cookie, defaulting to Dark. No new theme storage or cookie policy is introduced. Auth styling is scoped to the LMS entry frame. Clerk appearance follows the current theme. Light/Dark forms, SSR theme, toggle persistence, keyboard focus, overflow and axe are checked at 1440, 820 and 390 px. Review captures live in ignored `docs/reviews/lms-auth/`.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run build`
- `NODE_OPTIONS=--conditions=react-server npx tsx --test tests/lms-auth-domain.test.ts tests/lms-account-domain.test.ts` — four checks, including isolated PostgreSQL signup/no-entitlement, ownership, strict writes and Enrollment denial.
- `LMS_UI_OWNER=<existing seeded Development identity> npx playwright test --config=playwright.lms-auth.config.ts` — three browser cases: native host redirect and signed-out/deep routing, theme/responsive/axe and rejected returns; real owner session/deep lesson/native account pages/logout; real Development signup, denial, support, logout and Clerk recovery code form.
- `npx playwright test --config=playwright.d1.config.ts --project=d1-desktop --grep 'redirect policy|all dashboard routes redirect'` — existing Dashboard redirect/forged-identity regression checks.

Database domain tests use the existing loopback-only, distinct `_test` database guard and disposable migrated schema. Browser fixtures require Development Clerk keys and the explicitly verified loopback `mentoralm_dev/public` database. The unique `+clerk_test` signup identity, its ticket, and business User are deleted afterward; the existing owner identity, entitlement and enrollment are preserved. Clerk's reserved test emails use code 424242 and suppress delivery: [Clerk testing documentation](https://clerk.com/docs/guides/development/testing/test-emails-and-phones).

## Production owner configuration still required

Use one Production Clerk instance for the root domain `mentoralm.com` and `students.mentoralm.com`, with matching publishable/secret keys. Configure `NEXT_PUBLIC_SITE_URL=https://mentoralm.com` and `NEXT_PUBLIC_LMS_ORIGIN=https://students.mentoralm.com`; the application already validates these origins and includes both in authorized session parties. Configure Clerk's primary production domain, required DNS/TLS records and enabled authentication methods/OAuth callback settings. Explicitly allowlist `students` using Clerk's Allowed Subdomains setting. No separate satellite identity store is required for this same-root-domain topology.

Clerk documents session sharing across subdomains of the configured root domain in its [production deployment guide](https://clerk.com/docs/guides/development/deployment/production) and recommends the [subdomain allowlist](https://clerk.com/docs/guides/dashboard/dns-domains/subdomain-allowlist). This task changes no live DNS or deployment. Real production cookie/session sharing, OAuth-provider callbacks and email delivery must be smoke-tested over HTTPS once those domains are deployed. Local browser tests exercise Development Clerk sessions, native host routing and reserved OTP flows; they do not prove live production infrastructure.

## Files touched by this task

- `src/app/lms-auth/layout.tsx`, `sign-in/[[...sign-in]]/page.tsx`, `sign-up/[[...sign-up]]/page.tsx`
- `src/components/lms/LmsAuthFrame.tsx`, `LmsAuthEntry.tsx`, `LmsAuthForm.tsx`, `LmsAccessUnavailable.tsx`
- `src/styles/lms-auth.css`
- `src/lib/auth/lms-entry.ts`, `src/lib/auth/session.ts` (optional internal sign-in destination; existing default unchanged)
- `src/lib/platform/domains.ts`, `src/proxy.ts`
- `src/app/learn/layout.tsx`, `src/app/learn/page.tsx` (identity loading inside its existing boundary), `src/components/lms/LmsBoundary.tsx`, `src/components/lms/LmsSupport.tsx` (reusable composer callback/request defaults unchanged)
- `tests/lms-auth-domain.test.ts`, `tests/lms-auth.spec.ts`, `playwright.lms-auth.config.ts`, this report

No deployment, push, schema change, public redesign or Admin work is included.
