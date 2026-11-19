'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EnrollmentView } from '@/lib/marketplace/enrollment/types';
import type { PurchasePolicy } from '@/lib/marketplace/commerce/orders';
import { razorpayCheckoutInput } from '@/lib/marketplace/commerce/razorpay-client';
type Checkout = { open(): void; on(event: string, handler: () => void): void };
type RazorpayConstructor = new (options: {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (result: unknown) => void;
  modal: { ondismiss: () => void };
  theme: { color: string };
}) => Checkout;
let script: Promise<RazorpayConstructor> | null = null;
function loadCheckout() {
  const existing = (window as unknown as { Razorpay?: RazorpayConstructor })
    .Razorpay;
  if (existing) return Promise.resolve(existing);
  if (!script)
    script = new Promise<RazorpayConstructor>((resolve, reject) => {
      const node = document.createElement('script');
      node.src = 'https://checkout.razorpay.com/v1/checkout.js';
      node.async = true;
      node.onload = () => {
        const loaded = (window as unknown as { Razorpay?: RazorpayConstructor })
          .Razorpay;
        if (loaded) resolve(loaded);
        else {
          script = null;
          reject(Error('Payment checkout is unavailable.'));
        }
      };
      node.onerror = () => {
        script = null;
        node.remove();
        reject(Error('Payment checkout is unavailable.'));
      };
      document.head.append(node);
    });
  return script;
}
export function PaymentAction({
  view,
  availability,
  policy,
}: {
  view: EnrollmentView;
  availability: string;
  policy: PurchasePolicy | null;
}) {
  const router = useRouter(),
    [acknowledge, setAcknowledge] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [orderRef, setOrderRef] = useState<string | null>(null);
  async function post(path: string, data: unknown) {
    const response = await fetch(`/api/marketplace/commerce/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    if (!response.ok)
      throw Error(
        body.error || 'Please verify payment status or contact Support.',
      );
    return body;
  }
  async function start() {
    if (pending || !policy || !acknowledge) return;
    setPending(true);
    setMessage('Opening secure payment…');
    try {
      const order = await post('orders', {
        intentRef: view.ref,
        revision: view.revision,
        termsVersion: policy.version,
        acknowledge: true,
      });
      if (
        typeof order.ref !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(order.ref)
      )
        throw Error('Please reload and try again.');
      setOrderRef(order.ref);
      const rawSession = await post(`orders/${order.ref}/pay`, {});
      const session = razorpayCheckoutInput.parse(rawSession);
      if (session.provider !== 'RAZORPAY')
        throw Error('Payment checkout is unavailable.');
      const Constructor = await loadCheckout();
      const checkout = new Constructor({
        key: session.data.keyId,
        order_id: session.data.providerOrderId,
        amount: session.data.amountMinor,
        currency: session.data.currency,
        name: 'MentoraLM',
        description: view.quote.title,
        theme: { color: '#7650c6' },
        handler: (result) => {
          setMessage('Verifying payment…');
          void post(`orders/${order.ref}/return`, result)
            .then(() => router.push(`/orders/${order.ref}`))
            .catch((e) => {
              setMessage(e.message);
              setPending(false);
            });
        },
        modal: {
          ondismiss: () => {
            setPending(false);
            setMessage(
              'Payment window closed. Verify the current status before trying again.',
            );
          },
        },
      });
      checkout.on('payment.failed', () => {
        setMessage(
          'The payment was not completed. Verify the current status before trying again.',
        );
        setPending(false);
      });
      checkout.open();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : 'Please verify payment status or contact Support.',
      );
      setPending(false);
    }
  }
  return (
    <div className="commerce-payment-action">
      {availability === 'available' && policy ? (
        <label className="enrollment-consent">
          <input
            type="checkbox"
            checked={acknowledge}
            onChange={(e) => setAcknowledge(e.target.checked)}
          />{' '}
          <span>
            I acknowledge the{' '}
            <Link href={policy.termsPath}>purchase terms</Link> and{' '}
            <Link href={policy.privacyPath}>privacy notice</Link> for this
            program and the displayed total.
          </span>
        </label>
      ) : (
        <p>
          Payments are not available yet. Your saved enrollment details are
          preserved.
        </p>
      )}
      <button
        type="button"
        className="enrollment-primary"
        disabled={pending || availability !== 'available' || !acknowledge}
        onClick={start}
      >
        {pending ? 'Verifying payment…' : 'Continue to Payment'}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {orderRef && (
        <Link href={`/orders/${orderRef}`}>Check payment status</Link>
      )}
      <p>
        Payment confirmation is verified securely. Course access is provisioned
        separately.
      </p>
    </div>
  );
}
