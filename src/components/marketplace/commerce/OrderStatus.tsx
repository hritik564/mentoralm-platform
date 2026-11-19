'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { OrderView } from '@/lib/marketplace/commerce/orders';
import { programPrice } from '../program/presentation';
const labels: Record<string, string> = {
  PENDING_PAYMENT: 'Ready to pay',
  PAYMENT_PROCESSING: 'Payment pending',
  PAID: 'Payment successful',
  REVIEW: 'Payment needs review',
  CANCELLED: 'Payment cancelled',
  EXPIRED: 'Payment window expired',
  REFUND_PENDING: 'Refund or reversal needs review',
  REFUNDED: 'Payment refunded',
};
export function OrderStatus({ initial }: { initial: OrderView }) {
  const [order, setOrder] = useState(initial),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState('');
  async function verify() {
    setPending(true);
    setMessage('Verifying payment…');
    try {
      const response = await fetch(
        `/api/marketplace/commerce/orders/${order.ref}/reconcile`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || 'Payment status is temporarily unavailable.');
      setOrder(data);
      setMessage('Payment status checked.');
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : 'Contact Support for help verifying this payment.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="enrollment-card commerce-status">
      <p className="enrollment-eyebrow">Your purchase</p>
      <h1>
        {pending
          ? 'Verifying payment…'
          : order.failureCode === 'PAYMENT_FAILED' &&
              order.status === 'PAYMENT_PROCESSING'
            ? 'Payment failed — you can retry'
            : labels[order.status] || 'Payment status unavailable'}
      </h1>
      <h2>{order.program.title}</h2>
      <dl>
        <dt>Program fee</dt>
        <dd>{programPrice(order.program)}</dd>
        <dt>Total ({order.program.currency})</dt>
        <dd>{programPrice(order.program)}</dd>
        <dt>Order reference</dt>
        <dd className="commerce-reference">{order.ref}</dd>
      </dl>
      {order.status === 'PAID' ? (
        <p>
          Your purchase is confirmed. Delivery access is being prepared. Contact
          Support if you need help.
        </p>
      ) : order.status === 'REFUNDED' ? (
        <p>
          The provider has confirmed a refund. Purchased access is no longer
          active.
        </p>
      ) : ['REVIEW', 'REFUND_PENDING'].includes(order.status) ? (
        <p>
          Your payment needs a review. Contact Support with your order
          reference. Check your payment status before starting another purchase.
        </p>
      ) : (
        <p>
          A return page or closed payment window does not confirm payment.
          Verify the current status to continue.
        </p>
      )}
      <div className="enrollment-form-actions">
        {order.paymentStatus && (
          <button
            type="button"
            className="enrollment-primary"
            disabled={pending}
            onClick={verify}
          >
            Verify payment status
          </button>
        )}
        {['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(order.status) && (
          <Link href={`/checkout/${order.intentRef}`}>Return to checkout</Link>
        )}
        <Link href="/dashboard">Go to Dashboard</Link>
        <Link href="/dashboard/support">Contact Support</Link>
      </div>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </section>
  );
}
