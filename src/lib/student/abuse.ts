import 'server-only';
import { StudentError } from './errors';
export type MutationPolicy =
  | 'learning'
  | 'academic'
  | 'upload'
  | 'discussion'
  | 'support'
  | 'referral'
  | 'communication';
const limits: Record<MutationPolicy, number> = {
  learning: 120,
  academic: 120,
  upload: 10,
  discussion: 20,
  support: 10,
  referral: 10,
  communication: 5,
};
/** Per-process fixed windows; bounded memory and fail closed on saturation. Replace with shared atomic store at multi-instance deployment. */
export class LocalMutationLimiter {
  private windows = new Map<string, { expires: number; count: number }>();
  check(userId: string, policy: MutationPolicy, now = Date.now()) {
    const key = `${policy}:${userId}`;
    let entry = this.windows.get(key);
    if (!entry || entry.expires <= now) {
      for (const [k, v] of this.windows)
        if (v.expires <= now) this.windows.delete(k);
      if (this.windows.size >= 10000 && !this.windows.has(key))
        throw new StudentError('RATE_LIMITED');
      entry = { expires: now + 60000, count: 0 };
      this.windows.set(key, entry);
    }
    if (++entry.count > limits[policy]) throw new StudentError('RATE_LIMITED');
  }
}
export const mutationLimiter = new LocalMutationLimiter();
