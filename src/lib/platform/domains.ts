export const platformDomains = {
  website: 'https://mentoralm.com',
  lms: 'https://students.mentoralm.com',
} as const;

function configuredOrigin(value: string | undefined, expected: string) {
  if (!value) return null;
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.origin !== expected && !(local && url.protocol === 'http:'))
  )
    throw new Error(
      'Platform origin must be the approved HTTPS domain or a local HTTP origin.',
    );
  return url.origin;
}

export function deploymentOrigins(
  website = process.env.NEXT_PUBLIC_SITE_URL,
  lms = process.env.NEXT_PUBLIC_LMS_ORIGIN,
) {
  const origins = {
    website: configuredOrigin(website, platformDomains.website),
    lms: configuredOrigin(lms, platformDomains.lms),
  };
  if (origins.lms && (!origins.website || origins.lms === origins.website))
    throw new Error(
      'LMS domain configuration requires distinct approved website and LMS origins.',
    );
  if (
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_') &&
    (origins.website !== platformDomains.website ||
      origins.lms !== platformDomains.lms)
  )
    throw new Error(
      'Production identity requires both approved production origins.',
    );
  return origins;
}

const pages = [
  'lectures',
  'assignments',
  'resources',
  'discussions',
  'chat',
  'attendance',
  'certificates',
];
export function lmsInternalPath(path: string): string | null {
  if (path === '/' || path === '/learn' || path === '/learn/') return '/learn';
  const short = path.startsWith('/learn/') ? path.slice(6) : path;
  return pages.some((page) => short === `/${page}`) ||
    /^\/courses\/[a-zA-Z0-9_-]{1,100}(?:\/(?:lessons|activities|assignments)\/[a-zA-Z0-9_-]{1,100})?$/.test(
      short,
    ) ||
    /^\/discussions\/[a-zA-Z0-9_-]{1,100}$/.test(short) ||
    /^\/certificates\/[a-zA-Z0-9_-]{1,100}$/.test(short)
    ? `/learn${short}`
    : null;
}

export function lmsHref(path: string, origins = deploymentOrigins()): string {
  const internal = lmsInternalPath(path);
  if (!internal) throw new Error('Unapproved LMS path.');
  return origins.lms
    ? `${origins.lms}${internal === '/learn' ? '/' : internal.slice(6)}`
    : internal;
}

export function websiteHref(path: string, origins = deploymentOrigins()) {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/.test(path))
    throw new Error('Unapproved website path.');
  return `${origins.website || ''}${path}`;
}

/** Host controls routing only. Clerk and business authorization always run afterward. */
export function domainRoute(
  host: string,
  path: string,
  origins = deploymentOrigins(),
): { kind: 'next' | 'rewrite' | 'redirect'; path: string } {
  const lmsHost = origins.lms
    ? new URL(origins.lms).host
    : 'students.mentoralm.com';
  let requestHost: string | null = null;
  try {
    const authority = new URL(
      `${origins.lms ? new URL(origins.lms).protocol : 'https:'}//${host}`,
    );
    if (
      !authority.username &&
      !authority.password &&
      authority.pathname === '/' &&
      !authority.search &&
      !authority.hash
    )
      requestHost = authority.host;
  } catch {
    // Malformed authorities cannot select the LMS surface.
  }
  if (requestHost === lmsHost) {
    if (path.startsWith('/dashboard') && /^\/dashboard(?:\/|$)/.test(path))
      return {
        kind: 'redirect',
        path: `${origins.website || platformDomains.website}${path}`,
      };
    if (/^\/(?:sign-in|sign-up|api|_next|__clerk)(?:\/|$)/.test(path))
      return { kind: 'next', path };
    const internal = lmsInternalPath(path);
    return {
      kind: 'rewrite',
      path: internal || (path.startsWith('/learn/') ? path : `/learn${path}`),
    };
  }
  if (origins.lms && (path === '/learn' || path.startsWith('/learn/'))) {
    const internal = lmsInternalPath(path);
    if (internal) return { kind: 'redirect', path: lmsHref(internal, origins) };
  }
  return { kind: 'next', path };
}

export function learningItemHref(
  courseId: string,
  item: { id: string; type: string },
) {
  const kind =
    item.type === 'LESSON'
      ? 'lessons'
      : item.type === 'ASSIGNMENT'
        ? 'assignments'
        : 'activities';
  return lmsHref(`/learn/courses/${courseId}/${kind}/${item.id}`);
}

/** Approved deployment origins control routing; forwarded headers never select destinations. */
export function approvedRequestHost(
  host: string,
  origins = deploymentOrigins(),
) {
  try {
    if (!/^(?:[a-zA-Z0-9.-]+|\[[a-fA-F0-9:]+\])(?::[0-9]{1,5})?$/.test(host))
      return false;
    const parsed = new URL(`https://${host}`);
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    )
      return false;
    const allowed = [origins.website, origins.lms]
      .filter(Boolean)
      .map((o) => new URL(o!).host);
    if (allowed.length) return allowed.includes(parsed.host);
    return (
      ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      parsed.host === 'students.mentoralm.com' ||
      parsed.host === 'mentoralm.com'
    );
  } catch {
    return false;
  }
}
export function authorizedSessionParties() {
  const origins = deploymentOrigins();
  return origins.website && origins.lms
    ? [origins.website, origins.lms]
    : undefined;
}
export function trustedRequestOrigin(host: string) {
  host = host.toLowerCase();
  if (!approvedRequestHost(host)) throw new Error('Unapproved authority.');
  host = new URL(`https://${host}`).host;
  const origins = deploymentOrigins();
  for (const origin of [origins.website, origins.lms])
    if (origin && new URL(origin).host === host) return origin;
  return `${['mentoralm.com', 'students.mentoralm.com'].includes(host) ? 'https' : 'http'}://${host}`;
}
