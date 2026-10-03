import type { NextConfig } from 'next';
import { publicConfigurationHash } from './src/lib/production/build-config';
import { validateEnvironment } from './src/lib/production/config';
import { securityHeaders } from './src/lib/production/security';
validateEnvironment();
const nextConfig: NextConfig = {
  env: { MENTORALM_BUILD_PUBLIC_CONFIG_HASH: publicConfigurationHash() },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: Object.entries(securityHeaders())
          .filter(([key]) => key !== 'Strict-Transport-Security')
          .map(([key, value]) => ({
            key,
            value,
          })),
      },
    ];
  },
  reactStrictMode: true,
  // Clerk's internal rewrite must preserve the actual local/request origin.
  // Next's proxy URL normalization otherwise changes 127.0.0.1 to localhost.
  skipProxyUrlNormalize: true,
};
export default nextConfig;
