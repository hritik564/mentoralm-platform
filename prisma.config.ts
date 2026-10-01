import { defineConfig } from 'prisma/config';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generation/validation can run without infrastructure; deploy cannot.
  datasource: { url: process.env.DATABASE_URL || '' },
});
