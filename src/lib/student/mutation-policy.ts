export type MutationPolicy =
  | 'marketplace-start'
  | 'marketplace-onboarding'
  | 'marketplace-anonymous'
  | 'learning'
  | 'academic'
  | 'upload'
  | 'discussion'
  | 'support'
  | 'referral'
  | 'communication';
export const limits: Record<MutationPolicy, number> = {
  'marketplace-start': 20,
  'marketplace-onboarding': 60,
  'marketplace-anonymous': 120,
  learning: 120,
  academic: 120,
  upload: 10,
  discussion: 20,
  support: 10,
  referral: 10,
  communication: 5,
};
