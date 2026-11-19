import type { PublicOffering } from '@/lib/marketplace/types';

export const programDeliveryLabels = {
  ONLINE: 'Online',
  OFFLINE: 'In person',
  HYBRID: 'Hybrid',
} as const;

export const programAvailabilityLabels = {
  OPEN: 'Open',
  COMING_SOON: 'Coming soon',
  WAITLIST: 'Waitlist',
  CLOSED: 'Closed',
} as const;

export const programActionLabels = {
  OPEN: 'Enrollment Coming Soon',
  COMING_SOON: 'Coming Soon',
  WAITLIST: 'Waitlist Coming Soon',
  CLOSED: 'Enrollment Closed',
} as const;

export function programPrice(offering: PublicOffering) {
  if (offering.priceMinor === null) return 'To be announced';
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: offering.currency,
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(offering.priceMinor / 10 ** digits);
}

export function programStartDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}
