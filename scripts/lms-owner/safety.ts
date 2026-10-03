import type { PrismaClient } from '../../src/generated/prisma/client';

export function localSeedUrl(env: Record<string, string | undefined>): string {
  if (
    (env.MENTORALM_ENV && env.MENTORALM_ENV !== 'local') ||
    (env.NODE_ENV && env.NODE_ENV !== 'development') ||
    env.REPLIT_DEPLOYMENT === '1' ||
    env.CI ||
    env.VERCEL ||
    env.NETLIFY ||
    env.RENDER ||
    env.FLY_APP_NAME
  )
    throw Error('Owner seeding requires a local development environment.');
  const local = (host: string) =>
    ['localhost', '127.0.0.1', '[::1]'].includes(host);
  for (const name of [
    'NEXT_PUBLIC_SITE_URL',
    'NEXT_PUBLIC_LMS_ORIGIN',
    'NEXT_PUBLIC_ADMIN_ORIGIN',
    'REFERRAL_APP_ORIGIN',
  ]) {
    if (env[name]) {
      const origin = new URL(env[name]!);
      if (
        origin.protocol !== 'http:' ||
        !local(origin.hostname) ||
        origin.username ||
        origin.password
      )
        throw Error('Owner seeding rejects deployed origins.');
    }
  }
  if (
    !env.CLERK_SECRET_KEY?.startsWith('sk_test_') ||
    !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_')
  )
    throw Error('Existing Clerk Development keys are required.');
  const url = new URL(env.DATABASE_URL || '');
  if (
    !local(url.hostname) ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.pathname !== '/mentoralm_dev' ||
    url.hash
  )
    throw Error('Owner seeding is restricted to loopback mentoralm_dev.');
  for (const [key, value] of url.searchParams) {
    if (key !== 'schema' || value !== 'public')
      throw Error('Database connection overrides are not allowed.');
  }
  return url.toString();
}
export async function verifyDatabase(db: PrismaClient) {
  const rows = await db.$queryRaw<
    { name: string; schema: string }[]
  >`SELECT current_database() AS name, current_schema() AS schema`;
  if (
    rows.length !== 1 ||
    rows[0].name !== 'mentoralm_dev' ||
    rows[0].schema !== 'public'
  )
    throw Error(
      'Connected database/schema is not the approved local development target.',
    );
}
