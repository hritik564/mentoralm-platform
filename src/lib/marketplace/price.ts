/** Money remains an integer in storage; human input is converted with decimal strings. */
export const marketplacePriceMinorMax = 2147483647;

export function currencyFractionDigits(currency: string): number {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('Enter a three-letter uppercase currency code.');
  }
  return (
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

export function parseMarketplacePrice(
  input: string | null,
  currency: string,
): number | null {
  const precision = currencyFractionDigits(currency);
  const value = input?.trim() || '';
  if (!value) return null;
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    throw new Error(
      'Enter a nonnegative price using digits and an optional decimal point.',
    );
  }
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > precision) {
    throw new Error(
      precision === 0
        ? `Enter a whole-number price for ${currency}.`
        : `Use at most ${precision} decimal places for ${currency}.`,
    );
  }
  const minor = `${whole}${fraction.padEnd(precision, '0')}`.replace(
    /^0+(?=\d)/,
    '',
  );
  const maximum = String(marketplacePriceMinorMax);
  if (
    minor.length > maximum.length ||
    (minor.length === maximum.length && minor > maximum)
  ) {
    throw new Error(`The price exceeds the supported maximum for ${currency}.`);
  }
  return Number(minor);
}

export function marketplacePriceInput(
  priceMinor: number | null,
  currency: string,
): string {
  const precision = currencyFractionDigits(currency);
  if (priceMinor === null) return '';
  if (
    !Number.isInteger(priceMinor) ||
    priceMinor < 0 ||
    priceMinor > marketplacePriceMinorMax
  ) {
    throw new Error('The stored price is outside the supported integer range.');
  }
  const digits = String(priceMinor).padStart(precision + 1, '0');
  if (!precision) return digits;
  const whole = digits.slice(0, -precision);
  const fraction = digits.slice(-precision).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}
