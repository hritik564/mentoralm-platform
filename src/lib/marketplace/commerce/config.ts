import 'server-only';
import { razorpayAmountIssue } from './razorpay-amount';
import { RazorpayGateway } from './razorpay';
import { StudentError } from '../../student/errors';
import { platformEnvironment } from '../../production/config';
/** Legal documents must be owner-approved and published before this registry gains a version. */
export const purchaseTerms: Readonly<
  Record<string, { termsPath: string; privacyPath: string }>
> = Object.freeze({});
export function purchasePolicy() {
  const version = process.env.MARKETPLACE_PURCHASE_TERMS_VERSION || '';
  return Object.hasOwn(purchaseTerms, version)
    ? { version, ...purchaseTerms[version] }
    : null;
}
export function razorpayGateway() {
  const keyId = process.env.RAZORPAY_KEY_ID || '',
    keySecret = process.env.RAZORPAY_KEY_SECRET || '',
    webhook = process.env.RAZORPAY_WEBHOOK_SECRET || '',
    merchantRef = process.env.RAZORPAY_ACCOUNT_ID || '';
  const mode = platformEnvironment();
  if (
    mode === 'production' ||
    !/^rzp_test_[A-Za-z0-9]+$/.test(keyId) ||
    keyId.length > 100 ||
    keySecret.length < 16 ||
    keySecret.length > 200 ||
    webhook.length < 16 ||
    webhook.length > 200 ||
    !/^acc_[A-Za-z0-9]+$/.test(merchantRef)
  )
    throw new StudentError('UNAVAILABLE');
  const previous = process.env.RAZORPAY_PREVIOUS_WEBHOOK_SECRET;
  if (previous && (previous.length < 16 || previous.length > 200))
    throw new StudentError('UNAVAILABLE');
  return new RazorpayGateway({
    keyId,
    keySecret,
    merchantRef,
    webhookSecrets: previous ? [webhook, previous] : [webhook],
  });
}
export function paymentAvailability(quote?: {
  priceMinor: number;
  currency: string;
}) {
  if (quote) {
    const issue = razorpayAmountIssue(quote);
    if (issue) return issue;
  }
  try {
    const gateway = razorpayGateway();
    if (quote && !gateway.supports(quote.priceMinor, quote.currency))
      return 'amount-unavailable';
    return purchasePolicy() ? 'available' : 'terms-unavailable';
  } catch {
    return 'provider-unavailable';
  }
}
