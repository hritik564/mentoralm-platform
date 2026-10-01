export function databaseUrl(value = process.env.DATABASE_URL): string {
  if (!value) throw new Error('Database configuration is unavailable.');
  try {
    const url = new URL(value);
    if (
      !['postgresql:', 'postgres:'].includes(url.protocol) ||
      !url.hostname ||
      url.pathname.length < 2
    )
      throw new Error();
    return value;
  } catch {
    throw new Error('Database configuration is invalid.');
  }
}
export function referralOrigin(
  value = process.env.REFERRAL_APP_ORIGIN,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
}
