import { randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { offeringInput } from './marketplace-m2';
import { EnrollmentService } from '../../src/lib/marketplace/enrollment/service';
import { CommerceOrders } from '../../src/lib/marketplace/commerce/orders';
export const fixturePurchasePolicy = {
  version: 'test-fixture-terms-v1',
  termsPath: '/fixture-terms',
  privacyPath: '/fixture-privacy',
};
export async function readyPurchase(
  db: PrismaClient,
  userId?: string,
  title = 'Practical AI Foundations',
) {
  if (!userId)
    userId = (
      await db.user.create({
        data: { clerkUserId: `m4_fixture_${randomUUID()}` },
      })
    ).id;
  const { courseRef, ...data } = offeringInput(`m4-${randomUUID()}`);
  void courseRef;
  const offering = await db.marketplaceOffering.create({
    data: {
      ...data,
      title,
      publicationStatus: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });
  const service = new EnrollmentService(db);
  let intent = await service.start(userId, randomBytes(32).toString('hex'), {
    slug: offering.slug,
  });
  for (const step of [
    {
      step: 1,
      fullName: 'Synthetic Learner',
      phone: '+919876543210',
      city: 'Pune',
      region: 'Maharashtra',
      country: 'India',
    },
    {
      step: 2,
      educationLevel: 'UNDERGRADUATE',
      currentStatus: 'COLLEGE_STUDENT',
      institution: 'Synthetic Institute',
    },
    {
      step: 3,
      goal: 'Build practical technology skills through guided projects.',
      source: null,
    },
    { step: 4, consent: true },
  ])
    intent = await service.saveStep(intent.ref, userId, {
      revision: intent.revision,
      ...step,
    });
  const input = {
    intentRef: intent.ref,
    revision: intent.revision,
    termsVersion: fixturePurchasePolicy.version,
    acknowledge: true,
  };
  return {
    userId,
    offering,
    intent,
    input,
    async order() {
      return new CommerceOrders(db).create(
        userId!,
        input,
        fixturePurchasePolicy,
      );
    },
  };
}
