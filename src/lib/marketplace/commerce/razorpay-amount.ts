/** Initial adapter's exact integer bounds; shared by server admission and public explanation. */
export function razorpayAmountIssue(quote: {
  priceMinor: number;
  currency: string;
}) {
  if (quote.currency !== 'INR') return 'currency-unavailable';
  if (quote.priceMinor === 0) return 'free-unavailable';
  if (
    !Number.isInteger(quote.priceMinor) ||
    quote.priceMinor < 100 ||
    quote.priceMinor > 2147483647
  )
    return 'amount-unavailable';
  return null;
}
export function paymentUnavailableMessage(availability: string) {
  if (availability === 'free-unavailable')
    return 'Online enrollment for free programs is not available yet. No payment will be requested.';
  if (availability === 'currency-unavailable')
    return 'Online payment is currently available only for programs priced in INR. No currency conversion will be performed.';
  if (availability === 'amount-unavailable')
    return 'This program fee is outside the supported online payment range. Contact Support for help.';
  if (availability === 'terms-unavailable')
    return 'Payments are not available until the purchase terms are ready. Your saved enrollment details are preserved.';
  return 'Payments are not available yet. Your saved enrollment details are preserved.';
}
