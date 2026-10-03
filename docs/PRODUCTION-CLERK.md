# Clerk Production configuration (future operator work)

P1 did not access/create/modify Clerk Production or request keys. One future Production instance serves all three surfaces; no second user/auth database. Development identities are not automatically Production identities. Preserve existing unified PostgreSQL User and business authorization.

Clerk documents shared root-domain sessions and recommends narrowing allowed subdomains and `authorizedParties`. [Production deployment](https://clerk.com/docs/guides/development/deployment/production) and [subdomain allowlist](https://clerk.com/docs/guides/dashboard/dns-domains/subdomain-allowlist).

## Exact operator setup

- Create the Production instance with primary domain `mentoralm.com`. Use its published Frontend API `clerk.mentoralm.com` and Clerk Dashboard's exact generated DNS records/certificate instructions. Do not guess record targets.
- Inject that instance's `pk_live_` publishable key at build and runtime, and `sk_live_` secret only at runtime/server operator jobs via secret management. Application validates the decoded publishable-key domain; independently verify secret/instance correspondence. Never paste keys in chat or logs.
- Enable Allowed Subdomains; explicitly allow `students.mentoralm.com` and `admin.mentoralm.com` only. Root is already included. No wildcard or unnecessary satellite instance for the same root-domain application.
- Application `clerkMiddleware` authorizedParties is exactly `https://mentoralm.com`, `https://students.mentoralm.com`, `https://admin.mentoralm.com` when all three origins are configured. Matching Clerk settings are mandatory; forwarded hosts do not expand this list.
- Allow redirect origins for those exact three origins, matching ClerkProvider's configured list. Authentication routes are Website `/sign-in` and `/sign-up`, LMS `/sign-in` and `/sign-up` rewritten to its dedicated entry, Admin `/sign-in` rewritten to dedicated Admin entry. Admin has no public signup CTA. Fallback destinations remain `/dashboard`, LMS `/learn` translated to its canonical host, and Admin `/admin` translated to its host. Query return paths still pass application allowlists; an allowed origin is not permission to follow arbitrary return URLs.
- Enable the approved email/password methods, Clerk-controlled password recovery and verification. Verify Production email sending-domain DNS, delivery/reputation and verification behavior using controlled actual accounts. Do not assume Development's testing/password shortcuts apply in Production. App communication providers are separate and remain unconfigured.
- If OAuth is enabled, configure each provider's Production client/secret, consent-screen/domain verification and exact callback shown by Clerk (normally on the instance Frontend API, `/v1/oauth_callback`). Copy from Clerk/provider dashboard; do not substitute Development callbacks or invent callback hosts. OAuth remains optional pending owner configuration.
- Check shared secure-cookie/session behavior and logout across all three actual HTTPS domains. Do not manually replace Clerk session cookies. Device theme cookies carry preferences only and do not authorize anything. Configure DNS/TLS/CAA per Clerk instructions before release.

## Authorization and release checks

Student: Clerk → same User → LMS entitlement → Enrollment/publication/resource/Batch authorization. Admin: Clerk → effective persisted ADMIN → AdminAuthorization → GOVERNANCE/permission → resource. Clerk metadata/email/subdomain never grants these business permissions. A no-policy/empty scoped Admin has only its intentional no-permissions surface.

Public settings are compiled into the release. Changing origins or publishable key requires a rebuild and passes P1's startup fingerprint check; switching only environment values over a Development build is refused. Check all host/session/redirect and logout cases in the smoke plan before traffic. No automatic role provisioning or Clerk configuration runs at startup.

## Replit deployment binding

Keep this existing Clerk Production instance; do not enable Replit Auth, Neon Auth or provision another identity database. Enter keys directly in Replit deployment secrets, override copied Development values, and rebuild with all three canonical public origins. The generated replit.app hostname has only infrastructure probes and must not be an allowed Clerk product origin/session party. Complete DNS-only domain/TLS sequence in PRODUCTION-DEPLOYMENT.md before real auth verification.
