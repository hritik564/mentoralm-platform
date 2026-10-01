export interface ReferralRecord {
  id: string;
  displayName: string;
  status: 'invited' | 'joined' | 'qualified';
  date: string;
}
export interface ReferralSummary {
  code: string;
  linkTargetId: string;
  history: readonly ReferralRecord[];
}
export interface ReferralRegistry {
  links: Readonly<Record<string, string>>;
  trustedOrigins: readonly string[];
}
export function resolveReferralLink(
  targetId: string,
  registry: ReferralRegistry = { links: {}, trustedOrigins: [] },
): string | null {
  if (
    !/^[a-zA-Z0-9_-]+$/.test(targetId) ||
    !Object.hasOwn(registry.links, targetId)
  )
    return null;
  try {
    const raw = registry.links[targetId];
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !registry.trustedOrigins.includes(url.origin) ||
      !/^\/invite\/[a-zA-Z0-9_-]+$/.test(url.pathname) ||
      raw !== `${url.origin}${url.pathname}`
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export interface ReferralSharing {
  copy: (link: string) => Promise<void>;
  share?: (link: string) => Promise<void>;
}
export function browserReferralSharing(): ReferralSharing {
  return {
    copy: async (link) => {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(link);
    },
    ...(typeof navigator.share === 'function'
      ? {
          share: async (link: string) => {
            await navigator.share({ title: 'MentoraLM', url: link });
          },
        }
      : {}),
  };
}
