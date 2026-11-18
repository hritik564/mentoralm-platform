import { currencyFractionDigits } from '@/lib/marketplace/price';

export function marketplaceLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function marketplacePrice(value: number | null, currency: string) {
  if (value === null) return 'To be announced';
  const digits = currencyFractionDigits(currency);
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: value % 10 ** digits === 0 ? 0 : digits,
    maximumFractionDigits: digits,
  });
  return formatter.format(value / 10 ** digits);
}

export function marketplaceLocalDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
