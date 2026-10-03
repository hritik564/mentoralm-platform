import { createHash } from 'node:crypto';
export function publicConfigurationHash(env = process.env) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        [
          'NEXT_PUBLIC_SITE_URL',
          'NEXT_PUBLIC_LMS_ORIGIN',
          'NEXT_PUBLIC_ADMIN_ORIGIN',
          'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
        ].map((k) => env[k] || ''),
      ),
    )
    .digest('hex');
}
