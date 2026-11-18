import type { AdminOffering, AdminOfferingList } from '@/lib/marketplace/types';
export {
  publicationStatuses,
  availabilityStatuses,
  deliveryModes,
  marketplaceImages,
} from '@/lib/marketplace/types';
export type MarketplaceOffering = AdminOffering;
export type PublicationStatus = AdminOffering['publicationStatus'];
export type AvailabilityStatus = AdminOffering['availabilityStatus'];
export type MarketplaceOfferingList = AdminOfferingList;
export type MarketplaceCourseChoice = { ref: string; label: string };
