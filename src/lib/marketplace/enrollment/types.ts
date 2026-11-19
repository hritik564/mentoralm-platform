export const educationLevels = [
  'SCHOOL',
  'UNDERGRADUATE',
  'POSTGRADUATE',
  'VOCATIONAL',
  'OTHER',
] as const;
export const currentStatuses = [
  'SCHOOL_STUDENT',
  'COLLEGE_STUDENT',
  'WORKING_PROFESSIONAL',
  'PARENT_GUARDIAN',
  'OTHER',
] as const;
export const ENROLLMENT_HOURS = 24;
export const CONSENT_VERSION = 'enrollment-details-v1';
export type EnrollmentQuote = {
  slug: string;
  title: string;
  priceMinor: number;
  currency: string;
  durationLabel: string;
  deliveryMode: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  cohortStartsAt: string | null;
};
export type OnboardingValues = {
  fullName: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  educationLevel: string | null;
  currentStatus: string | null;
  institution: string | null;
  goal: string | null;
  source: string | null;
};
export type EnrollmentView = {
  ref: string;
  revision: string;
  state: string;
  access: 'active' | 'expired' | 'cancelled' | 'unavailable';
  needsClaim: boolean;
  quote: EnrollmentQuote;
  expiresAt: string;
  completedStep: number;
  completedAt: string | null;
  values: OnboardingValues;
};
