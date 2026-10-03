import 'server-only';
export type ProviderFetch = typeof fetch;
/** Bounded body/deadline; redirects cannot forward bearer credentials to another host. */
export async function providerJson(
  fetcher: ProviderFetch,
  url: string,
  token: string,
  body: unknown,
  timeoutMs = 2000,
  responseMode: 'json' | 'discard' = 'json',
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Error('Provider unavailable.'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, {
          method: 'POST',
          redirect: 'error',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw Error('Provider unavailable.');
        }
        if (responseMode === 'discard') {
          await response.body?.cancel();
          return null;
        }
        if (!response.body) return null;
        const reader = response.body.getReader();
        let bytes = 0,
          value = '';
        const decoder = new TextDecoder();
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            bytes += next.value.length;
            if (bytes > 8192) {
              await reader.cancel();
              throw Error('Provider unavailable.');
            }
            value += decoder.decode(next.value, { stream: true });
          }
          value += decoder.decode();
        } finally {
          reader.releaseLock();
        }
        return value ? JSON.parse(value) : null;
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
