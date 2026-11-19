import 'server-only';
import { razorpayAmountIssue } from './razorpay-amount';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { StudentError } from '../../student/errors';
import {
  providerId,
  type PaymentGateway,
  type PaymentEvidence,
  type GatewaySession,
  type VerifiedEvent,
} from './gateway';
const amount = z.number().int().nonnegative().max(2147483647);
const orderInput = z.object({
  id: providerId,
  receipt: z.string().max(40).nullable(),
  amount,
  currency: z.string().length(3),
  status: z.enum(['created', 'attempted', 'paid']),
  amount_paid: amount,
  amount_due: amount,
});
const paymentInput = z.object({
  id: providerId,
  order_id: providerId.nullable(),
  amount,
  currency: z.string().length(3),
  status: z.enum(['created', 'authorized', 'captured', 'failed', 'refunded']),
  amount_refunded: amount,
  captured: z.boolean(),
});
function signature(raw: Buffer | string, key: string, value: string | null) {
  if (!value || !/^[a-f0-9]{64}$/.test(value) || value.length !== 64)
    return false;
  return timingSafeEqual(
    createHmac('sha256', key).update(raw).digest(),
    Buffer.from(value, 'hex'),
  );
}
export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  webhookSecrets: readonly string[];
  merchantRef: string;
};
/** REST adapter uses only documented fixed HTTPS endpoints; no provider network at import/build. */
export class RazorpayGateway implements PaymentGateway {
  readonly provider = 'RAZORPAY';
  readonly merchantRef: string;
  constructor(
    private config: RazorpayConfig,
    private fetcher: typeof fetch = fetch,
  ) {
    this.merchantRef = config.merchantRef;
  }
  supports(minor: number, currency: string) {
    return razorpayAmountIssue({ priceMinor: minor, currency }) === null;
  }

  private async request(path: string, body?: unknown): Promise<unknown> {
    try {
      const response = await this.fetcher(
        `https://api.razorpay.com/v1${path}`,
        {
          method: body ? 'POST' : 'GET',
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(2000),
          cache: 'no-store',
          redirect: 'error',
        },
      );
      if (!response.ok) throw new StudentError('UNAVAILABLE');
      const reader = response.body?.getReader();
      if (!reader) throw new StudentError('UNAVAILABLE');
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 262144) {
          await reader.cancel();
          throw new StudentError('UNAVAILABLE');
        }
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new StudentError('UNAVAILABLE');
    }
  }
  private session(raw: unknown): GatewaySession {
    const r = orderInput.safeParse(raw);
    if (!r.success || !z.string().uuid().safeParse(r.data.receipt).success)
      throw new StudentError('UNAVAILABLE');
    return {
      id: r.data.id,
      receipt: r.data.receipt!,
      amountMinor: r.data.amount,
      currency: r.data.currency,
    };
  }
  async createSession(input: {
    receipt: string;
    amountMinor: number;
    currency: string;
  }) {
    if (!this.supports(input.amountMinor, input.currency))
      throw new StudentError('CONFLICT');
    return this.session(
      await this.request('/orders', {
        receipt: input.receipt,
        amount: input.amountMinor,
        currency: input.currency,
        partial_payment: false,
      }),
    );
  }
  async recoverSession(receipt: string) {
    if (!z.string().uuid().safeParse(receipt).success)
      throw new StudentError('INVALID_INPUT');
    const result = z
      .object({ items: z.array(orderInput).max(2) })
      .safeParse(
        await this.request(
          `/orders?receipt=${encodeURIComponent(receipt)}&count=2`,
        ),
      );
    if (!result.success || result.data.items.length > 1)
      throw new StudentError('UNAVAILABLE');
    const row = result.data.items[0];
    if (row && row.receipt !== receipt) throw new StudentError('UNAVAILABLE');
    return row ? this.session(row) : null;
  }
  async sessionForPayment(paymentId: string) {
    if (!providerId.safeParse(paymentId).success)
      throw new StudentError('INVALID_INPUT');
    const payment = paymentInput.safeParse(
      await this.request(`/payments/${paymentId}`),
    );
    if (!payment.success || payment.data.id !== paymentId)
      throw new StudentError('UNAVAILABLE');
    return payment.data.order_id;
  }
  async inspect(sessionId: string): Promise<PaymentEvidence> {
    if (!providerId.safeParse(sessionId).success)
      throw new StudentError('INVALID_INPUT');
    const [rawOrder, rawPayments] = await Promise.all([
      this.request(`/orders/${sessionId}`),
      this.request(`/orders/${sessionId}/payments`),
    ]);
    const o = orderInput.safeParse(rawOrder),
      p = z
        .object({ items: z.array(paymentInput).max(100) })
        .safeParse(rawPayments);
    if (!o.success || !p.success || o.data.id !== sessionId)
      throw new StudentError('UNAVAILABLE');
    if (
      o.data.status === 'paid' &&
      (o.data.amount_paid !== o.data.amount || o.data.amount_due !== 0)
    )
      throw new StudentError('UNAVAILABLE');
    return {
      merchantRef: this.merchantRef,
      sessionId: o.data.id,
      receipt: o.data.receipt || '',
      amountMinor: o.data.amount,
      currency: o.data.currency,
      paid: o.data.status === 'paid',
      payments: p.data.items.map((v) => {
        if (['captured', 'refunded'].includes(v.status) && !v.captured)
          throw new StudentError('UNAVAILABLE');
        if (!v.order_id) throw new StudentError('UNAVAILABLE');
        return {
          id: v.id,
          sessionId: v.order_id,
          amountMinor: v.amount,
          currency: v.currency,
          status: (
            {
              created: 'CREATED',
              authorized: 'AUTHORIZED',
              captured: 'CAPTURED',
              failed: 'FAILED',
              refunded: 'REFUNDED',
            } as const
          )[v.status],
          refundedMinor: v.amount_refunded,
        };
      }),
    };
  }
  verifyReturn(sessionId: string, input: unknown) {
    const result = z
      .object({
        razorpay_order_id: providerId.nullable(),
        razorpay_payment_id: providerId,
        razorpay_signature: z.string().length(64),
      })
      .strict()
      .safeParse(input);
    if (
      !result.success ||
      result.data.razorpay_order_id !== sessionId ||
      !signature(
        `${sessionId}|${result.data.razorpay_payment_id}`,
        this.config.keySecret,
        result.data.razorpay_signature,
      )
    )
      throw new StudentError('FORBIDDEN');
  }
  verifyWebhook(raw: Buffer, headers: Headers): VerifiedEvent {
    if (
      !this.config.webhookSecrets.some((key) =>
        signature(raw, key, headers.get('x-razorpay-signature')),
      )
    )
      throw new StudentError('FORBIDDEN');
    let body: unknown;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      throw new StudentError('INVALID_INPUT');
    }
    const entity = z.object({
      entity: z.object({
        id: providerId,
        order_id: providerId.nullable().optional(),
        payment_id: providerId.optional(),
        receipt: z.string().nullable().optional(),
      }),
    });
    const parsed = z
      .object({
        account_id: providerId,
        event: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z_.]+$/)
          .refine((v) => v === v.trim()),
        payload: z.object({
          payment: entity.optional(),
          order: entity.optional(),
          refund: entity.optional(),
          dispute: entity.optional(),
        }),
      })
      .safeParse(body);
    const id = providerId.safeParse(headers.get('x-razorpay-event-id'));
    if (!parsed.success || !id.success) throw new StudentError('INVALID_INPUT');
    if (parsed.data.account_id !== this.merchantRef)
      throw new StudentError('FORBIDDEN');
    const p = parsed.data.payload;
    return {
      kind: parsed.data.event.startsWith('payment.dispute.')
        ? 'DISPUTE'
        : parsed.data.event === 'refund.processed'
          ? 'REFUND_UPDATED'
          : [
                'payment.authorized',
                'payment.captured',
                'payment.failed',
                'order.paid',
              ].includes(parsed.data.event)
            ? 'PAYMENT_UPDATED'
            : 'IGNORED',
      id: id.data,
      type: parsed.data.event,
      merchantRef: this.merchantRef,
      sessionId: p.order?.entity.id || p.payment?.entity.order_id || null,
      paymentId:
        p.payment?.entity.id ||
        p.refund?.entity.payment_id ||
        p.dispute?.entity.payment_id ||
        null,
      digest: createHash('sha256').update(raw).digest('hex'),
    };
  }
  checkout(session: GatewaySession) {
    return {
      provider: this.provider,
      data: {
        keyId: this.config.keyId,
        providerOrderId: session.id,
        amountMinor: session.amountMinor,
        currency: session.currency,
      },
    };
  }
}
