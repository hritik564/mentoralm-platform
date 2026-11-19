import { z } from 'zod';
/** Initial provider's narrow public Checkout DTO; no provider secrets/raw API replies. */
export const razorpayCheckoutInput = z
  .object({
    provider: z.literal('RAZORPAY'),
    data: z
      .object({
        keyId: z.string().min(1).max(100),
        providerOrderId: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[A-Za-z0-9_-]+$/),
        amountMinor: z.number().int().nonnegative(),
        currency: z.string().length(3),
      })
      .strict(),
  })
  .strict();
