import { randomUUID } from 'node:crypto';
import type { OfferingInput } from '../../src/lib/marketplace/types';
import type { PrismaClient } from '../../src/generated/prisma/client';
export const offeringInput = (slug: string): OfferingInput => ({
  title: 'M2 Isolated Program',
  slug,
  shortDescription:
    'A structured program for practical skills and thoughtful career development.',
  category: 'Professional learning',
  cardImage: null,
  heroImage: null,
  deliveryMode: 'ONLINE',
  durationLabel: '12 weeks',
  priceMinor: 1500000,
  currency: 'INR',
  availabilityStatus: 'OPEN',
  featured: true,
  sortOrder: 0,
  lmsEnabled: false,
  courseRef: null,
  cohortStartsAt: null,
});
export const pageSettings = {
  eyebrow: 'Find your next chapter',
  heroHeadline: 'Build a purposeful future',
  heroSummary: 'Explore practical learning with a clear path forward.',
  seoTitle: 'Practical Learning | MentoraLM',
  seoDescription: 'A guided program with projects and practical outcomes.',
};
export const overviewSection = {
  type: 'OVERVIEW' as const,
  title: 'About this program',
  subtitle: null,
  enabled: true,
  content: { body: 'Learn through practical projects with a structured path.' },
};
export const outcomesSection = {
  type: 'OUTCOMES' as const,
  title: 'What you will learn',
  subtitle: null,
  enabled: true,
  content: { items: ['Plan a practical project', 'Present your work clearly'] },
};
export const faqSection = {
  type: 'FAQ' as const,
  title: 'Questions, answered',
  subtitle: null,
  enabled: true,
  content: {
    items: [
      {
        question: 'Is enrollment available?',
        answer:
          'Enrollment is coming soon. No payment or signup is collected here.',
      },
    ],
  },
};
export async function marketplaceActor(
  db: PrismaClient,
  permissions: ('MARKETPLACE_MANAGE' | 'ACADEMICS_MANAGE')[] = [
    'MARKETPLACE_MANAGE',
  ],
) {
  return db.user.create({
    data: {
      clerkUserId: `m2_${randomUUID()}`,
      roleAssignments: { create: { role: 'ADMIN' } },
      adminAuthorization: { create: { permissions } },
    },
  });
}
