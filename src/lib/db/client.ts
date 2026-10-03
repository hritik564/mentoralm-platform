import 'server-only';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { databaseUrl } from './config';
import { databasePoolConfig } from '../production/database';
const globalDatabase = globalThis as unknown as { mentoralmDb?: PrismaClient };
export function getDatabase() {
  if (!globalDatabase.mentoralmDb)
    globalDatabase.mentoralmDb = new PrismaClient({
      adapter: new PrismaPg(databasePoolConfig(), {
        schema: new URL(databaseUrl()).searchParams.get('schema') || 'public',
      }),
    });
  return globalDatabase.mentoralmDb;
}
