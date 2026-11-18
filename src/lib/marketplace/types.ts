/** Public editorial contracts; no enrollment, payment or entitlement behavior. */
export const deliveryModes = ['ONLINE', 'OFFLINE', 'HYBRID'] as const;
export const publicationStatuses = [
  'DRAFT',
  'PUBLISHED',
  'UNPUBLISHED',
  'ARCHIVED',
] as const;
export const availabilityStatuses = [
  'OPEN',
  'COMING_SOON',
  'WAITLIST',
  'CLOSED',
] as const;
export const marketplaceImages = [
  '/images/campus.webp',
  '/images/learner.webp',
  '/images/collaboration.webp',
  '/images/entrepreneurship.webp',
  '/images/counsellor.webp',
  '/images/homepage/careerignite.webp',
  '/images/homepage/youngminds-ai-lab.webp',
  '/brand/mentoralm-logo.jpeg',
] as const;
export type DeliveryMode = (typeof deliveryModes)[number];
export type PublicationStatus = (typeof publicationStatuses)[number];
export type AvailabilityStatus = (typeof availabilityStatuses)[number];
export type OfferingInput = {
  title: string;
  slug: string;
  shortDescription: string;
  category: string;
  cardImage: string | null;
  heroImage: string | null;
  deliveryMode: DeliveryMode;
  durationLabel: string;
  priceMinor: number | null;
  currency: string;
  availabilityStatus: AvailabilityStatus;
  featured: boolean;
  sortOrder: number;
  lmsEnabled: boolean;
  courseRef: string | null;
  cohortStartsAt: string | null;
};
export type PublicOffering = Pick<
  OfferingInput,
  | 'slug'
  | 'title'
  | 'shortDescription'
  | 'category'
  | 'cardImage'
  | 'heroImage'
  | 'deliveryMode'
  | 'durationLabel'
  | 'priceMinor'
  | 'currency'
  | 'availabilityStatus'
  | 'cohortStartsAt'
>;
export type AdminOffering = OfferingInput & {
  ref: string;
  revision: string;
  publicationStatus: PublicationStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AdminOfferingList = {
  page: number;
  total: number;
  rows: AdminOffering[];
};
export type PublicOfferingsResult =
  | {
      status: 'ready';
      offerings: PublicOffering[];
      total: number;
      page: number;
    }
  | { status: 'unavailable' };
