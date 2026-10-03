import { trustedRequestOrigin } from '../platform/domains';
export function sameOrigin(request: Request) {
  try {
    const host = request.headers.get('host') || new URL(request.url).host;
    return request.headers.get('origin') === trustedRequestOrigin(host);
  } catch {
    return false;
  }
}
