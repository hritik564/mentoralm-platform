# Production foundation P1

P1 prepares the existing application; it does not deploy, connect to Production, configure Clerk Production, change DNS or begin P2. The selected providers are Replit Reserved VM (Asia candidate), independent Neon PostgreSQL (AWS Singapore), Upstash and Better Stack. The approved Student LMS and Admin workflows remain frozen.

## Inspected runtime

Installed versions: Next.js 16.3.7 App Router, Clerk Next.js 7.9.8, Prisma 7.10.0 with PrismaPg, pg 8.23.1. The original P1 inspection found no hosting configuration. Provider preparation now adds .replit and server-only Upstash/Better Stack adapters; reusable domain boundaries remain. The architecture uses a supported Node.js runtime running one Next.js application behind an HTTPS ingress, one Clerk Production instance and one PostgreSQL Production database. Server routes require Node.js; an Edge-only/static-export topology is unsuitable.

| Surface                | Production URL                  | Internal application route |
| ---------------------- | ------------------------------- | -------------------------- |
| Website / module pages | https://mentoralm.com           | `/`, `/<module-slug>`      |
| Student Dashboard      | https://mentoralm.com/dashboard | `/dashboard`               |
| LMS                    | https://students.mentoralm.com  | `/learn` rewrites          |
| Admin                  | https://admin.mentoralm.com     | `/admin` rewrites          |

All three hosts route to the same release/application and share identity and business data. Authentication does not grant business access. Student entitlement/Enrollment/publication/Batch checks and effective ADMIN/policy/permission/resource checks remain server-authoritative.

## Implemented environment boundary

`src/lib/production/config-runtime.mjs` is the canonical plain-ESM validator; its typed `config.ts` facade validates `MENTORALM_ENV=local|test|production`. Development without a classification defaults local; optimized production runtime must be explicitly classified. `.env.example` is a local template. Ignored `.env.local` now explicitly says local; it contains no newly added secret. Production must use deployment-owned secret injection and exclude local environment files from its artifact. Node `NODE_ENV=production` alone does not identify a Production database.

Production requires exact approved HTTPS origins, a live publishable key whose decoded Frontend API host is `clerk.mentoralm.com`, a live secret key, an authenticated direct Neon Singapore database URL, and an explicit matching database name. Database URL must use public schema, `sslmode=require&sslaccept=strict`, with no other connection overrides. No Dev/test database name, test opt-in/URL, live keys in local/test, local media roots, disabled TLS verification, PG connection overrides or Clerk debug flag is accepted. Configuration errors identify fields/categories without values. Offline validation cannot prove that the live secret belongs to the same Clerk instance; that is an operator verification.

Public origins/key are build-time values. A compile-time hash of those public settings is checked against dynamically read runtime settings at startup; changing them requires rebuilding. Secrets and database credentials are not put in that hash. `next.config.ts` validates configuration. The supported `npm run start` invokes a plain-Node guard that validates configuration and the actual build artifact before spawning Next; Node instrumentation also revalidates. Next may lazily initialize instrumentation, so it is not the sole startup guard. Production startup refuses local environment files in the artifact. Direct invocation of the Next binary bypasses the explicit pre-listen guard and is not the supported deployment entrypoint. Startup does not connect to migrate/seed/promote/configure providers. Ordinary authenticated User provisioning remains the existing identity workflow, not startup seeding.

## Pool/runtime boundary

One Prisma client is reused per Node process, with configurable pool size 1–30 (default 8), connect timeout 1–10s (default 5s), idle timeout 1–60s (default 10s) and 10s query/statement bounds. Production pg uses explicit certificate/hostname validation with system trust. Private-CA providers need a reviewed adapter/configuration extension; disabling verification is prohibited. Total connection capacity is instances × workers × pool maximum plus operator/backup capacity; the direct Neon endpoint is required for both bounded runtime pooling and separately guarded migrations. Transaction-pooler URLs refuse. Serializability and transaction advisory locks are preserved. [Pool sizing and lifecycle reference](https://node-postgres.com/apis/pool).

## Readiness is intentionally not a launch approval

`/api/health` is process liveness. `/api/readiness` checks safe configuration, connectivity, actual database/schema, all eleven migration names/checksums and enabled audit guards/core tables. Calls coalesce per process and cache for five seconds; the probe runs a read-only transaction with statement/transaction bounds. Responses expose only status, not internal diagnostics.

Production readiness now requires the Upstash expiring EVAL/write probe as well as database/migration/audit checks. Missing or failed authority remains 503; sensitive mutations fail closed with no local fallback. Local/test limits remain. Better Stack transport is best effort and never a readiness dependency. Optional providers stay disabled; P1 infrastructure readiness is not launch approval.

Local filesystem media is NOT PRODUCTION READY. Object storage, video/recording, scanning, certificate rendering, email, WhatsApp and in-app delivery remain NOT CONFIGURED. P2 must supply real private adapters before dependent features can launch; PENDING_PROVIDER is unchanged. Health does not represent provider readiness.

See [Deployment](PRODUCTION-DEPLOYMENT.md), [Database/restore](PRODUCTION-DATABASE.md), [Clerk](PRODUCTION-CLERK.md), [Security](PRODUCTION-SECURITY.md) and [Smoke tests](PRODUCTION-SMOKE-TEST.md). Historical foundation evidence is recorded in [P1 validation](PRODUCTION-P1-VALIDATION.md); current settings and evidence are in [Provider preparation](PRODUCTION-PROVIDERS.md) and [Provider validation](PRODUCTION-PROVIDERS-VALIDATION.md).
