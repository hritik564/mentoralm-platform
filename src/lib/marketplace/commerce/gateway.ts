import type { z } from 'zod';
import { z as schema } from 'zod';
export const providerId = schema
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/)
  .refine((v) => v === v.trim());
const money = schema.number().int().min(0).max(2147483647);
export const evidenceInput = schema.object({
  merchantRef: providerId,
  sessionId: providerId,
  receipt: schema.string().max(100),
  amountMinor: money,
  currency: schema.string().regex(/^[A-Z]{3}$/),
  paid: schema.boolean(),
  payments: schema
    .array(
      schema.object({
        id: providerId,
        sessionId: providerId,
        amountMinor: money,
        currency: schema.string().regex(/^[A-Z]{3}$/),
        status: schema.enum([
          'CREATED',
          'AUTHORIZED',
          'CAPTURED',
          'FAILED',
          'REFUNDED',
        ]),
        refundedMinor: money,
      }),
    )
    .max(100),
});
export type PaymentEvidence = z.infer<typeof evidenceInput>;
export type GatewaySession = {
  id: string;
  receipt: string;
  amountMinor: number;
  currency: string;
};
export type VerifiedEvent = {
  kind: 'PAYMENT_UPDATED' | 'REFUND_UPDATED' | 'DISPUTE' | 'IGNORED';
  id: string;
  type: string;
  sessionId: string | null;
  paymentId: string | null;
  digest: string;
  merchantRef: string;
};
/** Provider-specific presentation data, never read by commercial settlement rules. */
export type CheckoutSession = {
  provider: string;
  data: Record<string, string | number | boolean>;
};
/** Only server implementations produce evidence; browser return data is never evidence. */
export interface PaymentGateway {
  readonly provider: string;
  readonly merchantRef: string;
  supports(amountMinor: number, currency: string): boolean;
  createSession(input: {
    receipt: string;
    amountMinor: number;
    currency: string;
  }): Promise<GatewaySession>;
  recoverSession(receipt: string): Promise<GatewaySession | null>;
  sessionForPayment(paymentId: string): Promise<string | null>;
  inspect(sessionId: string): Promise<PaymentEvidence>;
  verifyReturn(sessionId: string, input: unknown): void;
  verifyWebhook(raw: Buffer, headers: Headers): VerifiedEvent;
  checkout(session: GatewaySession): CheckoutSession;
}
