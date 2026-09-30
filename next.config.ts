import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Clerk's internal rewrite must preserve the actual local/request origin.
  // Next's proxy URL normalization otherwise changes 127.0.0.1 to localhost.
  skipProxyUrlNormalize: true,
};
export default nextConfig;
