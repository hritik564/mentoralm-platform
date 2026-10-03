import 'server-only';
import { platformEnvironment, type Environment } from './config';
import { logRecord, type LogContext, type LogEvent } from './log-record';
import { providerJson, type ProviderFetch } from './provider-http';
export function betterStackConfiguration(env: Environment) {
  if (platformEnvironment(env) !== 'production') return null;
  try {
    const u = new URL(env.BETTER_STACK_INGEST_URL || '');
    const token = env.BETTER_STACK_SOURCE_TOKEN || '';
    if (
      u.protocol !== 'https:' ||
      !/^s[0-9]+\.[a-z0-9-]+\.betterstackdata\.com$/.test(u.hostname) ||
      u.port ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname !== '/' ||
      !token ||
      token.length > 4096 ||
      /\s/.test(token)
    )
      return null;
    return { url: u.origin, token };
  } catch {
    return null;
  }
}
/** Best effort, at most four in-flight sends; no queue/retries, and 30s cooldown on failure. */
export class BetterStackTransport {
  private pending = new Set<Promise<void>>();
  private retryAfter = 0;
  constructor(
    private environment: () => Environment = () => process.env,
    private fetcher: ProviderFetch = (...args) => fetch(...args),
    private timeoutMs = 2000,
  ) {}
  emit(
    input: LogContext & { level: 'info' | 'warn' | 'error'; event: LogEvent },
  ) {
    try {
      const env = this.environment();
      const config = betterStackConfiguration(env);
      if (!config || this.pending.size >= 4 || Date.now() < this.retryAfter)
        return;
      // Project fields again at the transport boundary; structural typing is not a privacy boundary.
      const record = logRecord(input.level, input.event, input);
      const task = providerJson(
        this.fetcher,
        config.url,
        config.token,
        {
          ...record,
          dt: record.timestamp,
          environment: 'production',
          runtime: 'node',
        },
        this.timeoutMs,
        'discard',
      )
        .then(() => undefined)
        .catch(() => {
          this.retryAfter = Date.now() + 30000;
        })
        .finally(() => {
          this.pending.delete(task);
        });
      this.pending.add(task);
    } catch {
      /* Observability must never affect the caller, including bad optional config. */
    }
  }
  async settled() {
    await Promise.allSettled([...this.pending]);
  }
}
