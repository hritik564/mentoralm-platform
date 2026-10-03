import 'server-only';
import { StudentError } from './errors';
import { platformEnvironment } from '../production/config';
import { UpstashMutationLimiter } from '../production/upstash';
import { limits, type MutationPolicy } from './mutation-policy';
export type { MutationPolicy } from './mutation-policy';
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
export interface MutationLimiter {
  check(userId: string, policy: MutationPolicy): Promise<void>;
}
const localLimiter = new LocalMutationLimiter();
const distributedLimiter = new UpstashMutationLimiter();
/** Production authority is distributed; unavailable configuration never falls back locally. */
export const mutationLimiter: MutationLimiter = {
  async check(userId, policy) {
    let mode;
    try {
      mode = platformEnvironment();
    } catch {
      throw new StudentError('UNAVAILABLE');
    }
    if (mode === 'production') return distributedLimiter.check(userId, policy);
    localLimiter.check(userId, policy);
  },
};
