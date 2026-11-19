import { commercePayments } from '@/lib/marketplace/commerce/server';
import {
  commerceResponse,
  paymentWebhook,
} from '@/lib/marketplace/commerce/http';
import { withRequestContext } from '@/lib/production/request-context';
export const dynamic = 'force-dynamic';
// Razorpay raw-body signature replaces browser/Clerk authentication only here.
export async function POST(request: Request) {
  return withRequestContext(request, () =>
    commerceResponse(() => paymentWebhook(request, commercePayments())),
  );
}
