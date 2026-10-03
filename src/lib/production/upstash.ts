import 'server-only';
import { createHash } from 'node:crypto';
import { upstashConfiguration, type Environment } from './config';
import { providerJson, type ProviderFetch } from './provider-http';
import { limits, type MutationPolicy } from '../student/mutation-policy';
import { StudentError } from '../student/errors';
/** Server-clock fixed window. Admission, increment and expiration are one atomic operation. */
export const mutationWindowScript = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if count >= limit then
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl <= 0 then return {-1, ttl} end
  return {0, ttl}
end
count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then return {-1, ttl} end
return {1, ttl}
`;
// Confirms EVAL/write/TTL permissions, not merely network connectivity or read-only PING.
const readinessScript = `redis.call('SET', KEYS[1], 'ok', 'PX', 10000) return redis.call('PTTL', KEYS[1])`;
export class UpstashMutationLimiter {
  constructor(
    private environment: () => Environment = () => process.env,
    private fetcher: ProviderFetch = (...args) => fetch(...args),
    private timeoutMs = 2000,
  ) {}
  async check(userId: string, policy: MutationPolicy): Promise<void> {
    let result: unknown;
    try {
      if (!userId || userId.length > 200 || !Object.hasOwn(limits, policy))
        throw Error();
      const { url, token } = upstashConfiguration(this.environment());
      const identifier = createHash('sha256').update(userId).digest('hex');
      result = await providerJson(
        this.fetcher,
        url,
        token,
        [
          'EVAL',
          mutationWindowScript,
          '1',
          `mentoralm:production:mutation:v1:${policy}:${identifier}`,
          String(limits[policy]),
          '60000',
        ],
        this.timeoutMs,
      );
      if (
        !result ||
        typeof result !== 'object' ||
        'error' in result ||
        !('result' in result)
      )
        throw Error();
      result = result.result;
      if (
        !Array.isArray(result) ||
        result.length !== 2 ||
        ![0, 1].includes(result[0]) ||
        !Number.isInteger(result[1]) ||
        result[1] <= 0 ||
        result[1] > 60000
      )
        throw Error();
    } catch {
      throw new StudentError('UNAVAILABLE');
    }
    if ((result as number[])[0] === 0) throw new StudentError('RATE_LIMITED');
  }
}
export async function upstashReady(
  env: Environment = process.env,
  fetcher: ProviderFetch = (...args) => fetch(...args),
) {
  try {
    const { url, token } = upstashConfiguration(env);
    const result = await providerJson(fetcher, url, token, [
      'EVAL',
      readinessScript,
      '1',
      'mentoralm:production:readiness:v1',
    ]);
    return (
      !!result &&
      typeof result === 'object' &&
      !('error' in result) &&
      'result' in result &&
      typeof result.result === 'number' &&
      Number.isInteger(result.result) &&
      result.result > 0 &&
      result.result <= 10000
    );
  } catch {
    return false;
  }
}
