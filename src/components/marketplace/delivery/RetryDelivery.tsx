'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function RetryDelivery({ reference }: { reference: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    router = useRouter();
  async function retry() {
    setBusy(true);
    try {
      const r = await fetch(
        `/api/admin/marketplace/delivery/${reference}/retry`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        },
      );
      if (!r.ok)
        throw Error(
          'Provisioning could not be checked. Review your permissions or try again later.',
        );
      setMessage('Provisioning checked. Review the current delivery status.');
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : 'Provisioning is unavailable.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button type="button" onClick={retry} disabled={busy}>
        {busy ? 'Checking delivery…' : 'Retry Provisioning'}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
