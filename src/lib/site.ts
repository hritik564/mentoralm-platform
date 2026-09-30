export function getSiteOrigin(
  value = process.env.NEXT_PUBLIC_SITE_URL,
): URL | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error(
      'NEXT_PUBLIC_SITE_URL must be an approved HTTP(S) origin without credentials, a path, query, or fragment.',
    );
  return url;
}
