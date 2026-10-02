'use client';
import { useEffect, useState } from 'react';
export async function adminRequest<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (
    body !== undefined &&
    path.startsWith('academic/') &&
    new Blob([JSON.stringify(body)]).size > 16384
  )
    throw Error(
      'This content is too long to save in one editor. Split it into smaller learning items or shorten the text/options.',
    );
  const response = await fetch(`/api/admin/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || 'Admin data is temporarily unavailable.');
  return data as T;
}
export function useAdminData<T>(path: string | null) {
  const [version, setVersion] = useState(0),
    [state, setState] = useState<{
      key: string;
      path: string | null;
      data?: T;
      error?: string;
    }>({
      key: '',
      path: null,
    });
  const key = `${path}:${version}`;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    adminRequest<T>(path, undefined, controller.signal)
      .then((data) => setState({ key, path, data }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            key,
            path,
            error:
              error instanceof Error
                ? error.message
                : 'Unable to load Admin data.',
          });
      });
    return () => controller.abort();
  }, [path, key]);
  return {
    data: state.path === path ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    loading: !!path && state.key !== key,
    reload: () => setVersion((v) => v + 1),
  };
}
export function useAdminMutation(reload: () => void) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  async function save(path: string, body: unknown) {
    setBusy(true);
    setNotice('');
    try {
      const result = await adminRequest<{ ref?: string }>(path, body);
      setNotice('Changes saved.');
      reload();
      return result;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Unable to save changes.',
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { save, busy, notice };
}
