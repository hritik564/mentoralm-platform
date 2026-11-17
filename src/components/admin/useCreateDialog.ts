'use client';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { adminHref } from '@/lib/platform/domains';
/** URL intent opens an existing editor; closing consumes it without changing business state. */
export function useAdminCreateDialog(
  kind: 'course' | 'batch',
  path: '/admin/courses' | '/admin/batches',
  enabled = true,
) {
  const search = useSearchParams(),
    router = useRouter();
  const [localOpen, setLocalOpen] = useState(false);
  const intent = enabled && search.get('create') === kind;
  return {
    open: enabled && (intent || localOpen),
    show: () => setLocalOpen(true),
    close: () => {
      setLocalOpen(false);
      if (intent) {
        const next = new URLSearchParams(search.toString());
        next.delete('create');
        router.replace(`${adminHref(path)}${next.size ? `?${next}` : ''}`);
      }
    },
  };
}
