import { createHmac } from 'node:crypto';
import { RazorpayGateway } from '../../src/lib/marketplace/commerce/razorpay';
export function providerFixture() {
  const config = {
    keyId: ['rzp', '_', 'test', '_', 'SyntheticOnly'].join(''),
    keySecret: 'm4-synthetic-api-secret-not-operational',
    webhookSecrets: ['m4-synthetic-webhook-secret-not-operational'],
    merchantRef: 'acc_fixture',
  };
  type Payment = {
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
    captured: boolean;
    amount_refunded: number;
  };
  type Session = {
    id: string;
    receipt: string;
    amount: number;
    currency: string;
    status: string;
    amount_paid: number;
    amount_due: number;
    payments: Payment[];
  };
  const sessions = new Map<string, Session>();
  let creates = 0,
    unavailable = false,
    loseCreateResponse = false;
  const fetcher: typeof fetch = async (url, init) => {
    if (unavailable) throw Error('synthetic outage');
    const u = new URL(String(url));
    if (u.origin !== 'https://api.razorpay.com')
      throw Error('unexpected provider endpoint');
    if (
      new Headers(init?.headers).get('Authorization') !==
      `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')}`
    )
      throw Error('wrong merchant transport');
    const path = u.pathname.replace('/v1', '');
    let value: unknown;
    if (path === '/orders' && init?.method === 'POST') {
      const input = JSON.parse(String(init.body));
      creates++;
      const row = {
        id: `order_fixture${creates}`,
        receipt: input.receipt,
        amount: input.amount,
        currency: input.currency,
        status: 'created',
        amount_paid: 0,
        amount_due: input.amount,
        payments: [],
      };
      sessions.set(row.id, row);
      if (loseCreateResponse) {
        loseCreateResponse = false;
        throw Error('synthetic lost acknowledgement');
      }
      value = row;
    } else if (path === '/orders')
      value = {
        items: [...sessions.values()].filter(
          (s) => s.receipt === u.searchParams.get('receipt'),
        ),
      };
    else if (path.startsWith('/payments/'))
      value = [...sessions.values()]
        .flatMap((s) => s.payments)
        .find((p) => p.id === path.split('/')[2]);
    else {
      const [, kind, id, child] = path.split('/');
      if (kind !== 'orders') throw Error('unexpected resource');
      const row = sessions.get(id);
      value = child === 'payments' ? { items: row?.payments } : row;
    }
    return Response.json(value || {}, { status: value ? 200 : 404 });
  };
  const gateway = new RazorpayGateway(config, fetcher);
  function payment(sessionId: string, patch: Partial<Payment> = {}) {
    const row = sessions.get(sessionId)!;
    const p = {
      id: `pay_fixture${creates}`,
      order_id: row.id,
      amount: row.amount,
      currency: row.currency,
      status: 'captured',
      captured: true,
      amount_refunded: 0,
      ...patch,
    };
    row.payments = [p];
    row.status = ['captured', 'refunded'].includes(p.status)
      ? 'paid'
      : 'attempted';
    row.amount_paid = row.status === 'paid' ? row.amount : 0;
    row.amount_due = row.status === 'paid' ? 0 : row.amount;
    return p;
  }
  function event(
    sessionId: string,
    type = 'payment.captured',
    id = 'evt_fixture',
  ) {
    const row = sessions.get(sessionId)!,
      p = row.payments[0];
    const payload =
      type === 'order.paid'
        ? { order: { entity: { id: sessionId } } }
        : type === 'refund.processed'
          ? { refund: { entity: { id: 'rfnd_fixture', payment_id: p.id } } }
          : type.startsWith('payment.dispute.')
            ? {
                payment: { entity: { id: p.id, order_id: sessionId } },
                dispute: { entity: { id: 'disp_fixture', payment_id: p.id } },
              }
            : {
                payment: {
                  entity: { id: p?.id || 'pay_pending', order_id: sessionId },
                },
              };
    const raw = Buffer.from(
      JSON.stringify({ account_id: config.merchantRef, event: type, payload }),
    );
    return {
      raw,
      headers: new Headers({
        'content-type': 'application/json',
        'x-razorpay-event-id': id,
        'x-razorpay-signature': createHmac('sha256', config.webhookSecrets[0])
          .update(raw)
          .digest('hex'),
      }),
    };
  }
  return {
    gateway,
    config,
    sessions,
    payment,
    event,
    get creates() {
      return creates;
    },
    set outage(value: boolean) {
      unavailable = value;
    },
    set loseCreateResponse(value: boolean) {
      loseCreateResponse = value;
    },
    returnSignature(session: string, payment: string) {
      return createHmac('sha256', config.keySecret)
        .update(`${session}|${payment}`)
        .digest('hex');
    },
  };
}
