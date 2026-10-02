import {
  deploymentOrigins,
  lmsInternalPath,
  trustedRequestOrigin,
  platformDomains,
} from '../platform/domains';
export function isLmsHost(host: string) {
  const origin = trustedRequestOrigin(host);
  return origin === (deploymentOrigins().lms || platformDomains.lms);
}
/** Raw return input is internal-only; even an absolute approved URL is rejected. */
export function lmsReturn(value: unknown) {
  const valid =
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\\%?#\s]/.test(value)
      ? lmsInternalPath(value)
      : null;
  return {
    internal: valid || '/learn',
    rejected: value !== undefined && !valid,
  };
}
export function lmsAuthPath(mode: 'sign-in' | 'sign-up', host?: string) {
  return host && isLmsHost(host) ? `/${mode}` : `/lms-auth/${mode}`;
}
export function lmsAuthReturn(
  mode: 'sign-in' | 'sign-up',
  internal: string,
  host?: string,
) {
  return `${lmsAuthPath(mode, host)}?redirect_url=${encodeURIComponent(lmsReturn(internal).internal)}`;
}
