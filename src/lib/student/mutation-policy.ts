export type MutationPolicy =
  | 'learning'
  | 'academic'
  | 'upload'
  | 'discussion'
  | 'support'
  | 'referral'
  | 'communication';
export const limits: Record<MutationPolicy, number> = {
  learning: 120,
  academic: 120,
  upload: 10,
  discussion: 20,
  support: 10,
  referral: 10,
  communication: 5,
};
