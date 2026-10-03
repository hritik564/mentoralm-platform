export type Environment = Record<string, string | undefined>;
export type PlatformEnvironment = 'local' | 'test' | 'production';
export class ConfigurationError extends Error {
  fields: string[];
  constructor(fields: string[]);
}
export const approvedOrigins: {
  readonly NEXT_PUBLIC_SITE_URL: 'https://mentoralm.com';
  readonly NEXT_PUBLIC_LMS_ORIGIN: 'https://students.mentoralm.com';
  readonly NEXT_PUBLIC_ADMIN_ORIGIN: 'https://admin.mentoralm.com';
};
export function platformEnvironment(env?: Environment): PlatformEnvironment;
export function productionDatabaseUrl(
  value: string | undefined,
  expected: string | undefined,
): URL;
export function validateEnvironment(env?: Environment): {
  mode: PlatformEnvironment;
  poolMax: number;
  connectTimeout: number;
  idleTimeout: number;
};

export function neonDirectUrl(
  value: string | undefined,
  expected: string | undefined,
): URL;
export function upstashConfiguration(env?: Environment): {
  url: string;
  token: string;
};
