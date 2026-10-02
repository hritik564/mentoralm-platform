import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import { StudentError } from '../student/errors';
export interface Identity {
  name: string;
  email: string;
  phone: string | null;
  status: 'Active' | 'Locked';
}
export interface Directory {
  search: (query: string) => Promise<string[]>;
  lookup: (ids: string[]) => Promise<Map<string, Identity>>;
}
export const clerkDirectory: Directory = {
  async search(query) {
    const result = await (
      await clerkClient()
    ).users.getUserList({ query, limit: 100 });
    if (result.totalCount > 100) throw new StudentError('INVALID_INPUT');
    return result.data.map((u) => u.id);
  },
  async lookup(ids) {
    if (!ids.length) return new Map();
    if (ids.length > 100) throw new StudentError('INVALID_INPUT');
    const result = await (
      await clerkClient()
    ).users.getUserList({ userId: ids, limit: 100 });
    return new Map(
      result.data.map((u) => [
        u.id,
        {
          name: u.fullName || u.username || 'Student',
          email:
            u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
              ?.emailAddress || '',
          phone:
            u.phoneNumbers.find((p) => p.id === u.primaryPhoneNumberId)
              ?.phoneNumber || null,
          status: u.banned || u.locked ? 'Locked' : 'Active',
        },
      ]),
    );
  },
};
