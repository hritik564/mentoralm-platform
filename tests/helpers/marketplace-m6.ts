import { randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient, Role } from '../../src/generated/prisma/client';
import {
  offeringInput,
  pageSettings,
  marketplaceActor,
} from './marketplace-m2';
import { fixturePurchasePolicy } from './marketplace-m4';
import { providerFixture } from './marketplace-m4-provider';
import { EnrollmentService } from '../../src/lib/marketplace/enrollment/service';
import { CommerceOrders } from '../../src/lib/marketplace/commerce/orders';
import { CommercePayments } from '../../src/lib/marketplace/commerce/payments';
import { AdminMarketplacePages } from '../../src/lib/marketplace/admin-pages';

const merchants = new WeakMap<
  PrismaClient,
  ReturnType<typeof providerFixture>
>();
export const m6Steps = [
  {
    step: 1,
    fullName: 'Synthetic M6 Learner',
    phone: '+919876543210',
    city: 'Pune',
    region: 'Maharashtra',
    country: 'India',
  },
  {
    step: 2,
    educationLevel: 'UNDERGRADUATE',
    currentStatus: 'WORKING_PROFESSIONAL',
    institution: null,
  },
  {
    step: 3,
    goal: 'Develop practical skills through thoughtful guided learning.',
    source: null,
  },
  { step: 4, consent: true },
];
export async function m6Flow(
  db: PrismaClient,
  options: {
    title?: string;
    anonymous?: boolean;
    role?: Role;
    provider?: ReturnType<typeof providerFixture>;
    userId?: string;
    courseId?: string;
    price?: number | null;
    currency?: string;
  } = {},
) {
  const user = options.userId
    ? await db.user.findUniqueOrThrow({ where: { id: options.userId } })
    : await db.user.create({
        data: {
          clerkUserId: `m6_${randomUUID()}`,
          role: options.role || 'STUDENT',
        },
      });
  const course = options.courseId
    ? await db.course.findUniqueOrThrow({ where: { id: options.courseId } })
    : await db.course.create({
        data: {
          title: 'M6 Guided Learning',
          description: 'Practical learning',
          published: true,
          thumbnailPath: '/images/campus.webp',
          thumbnailAlt: 'Campus',
          publicPath: '/#programs',
        },
      });
  const section = await db.section.create({
    data: {
      courseId: course.id,
      title: 'M6 section',
      position:
        (await db.section.count({ where: { courseId: course.id } })) + 1,
      published: true,
    },
  });
  const item = await db.learningItem.create({
    data: {
      sectionId: section.id,
      title: 'M6 practical lesson',
      type: 'LESSON',
      position: 1,
      published: true,
      lesson: {
        create: {
          format: 'TEXT',
          structuredContent: {
            version: 1,
            blocks: [{ type: 'paragraph', text: 'M6 authorized content' }],
          },
        },
      },
    },
  });
  const { courseRef, ...data } = offeringInput(`m6-${randomUUID()}`);
  void courseRef;
  const offering = await db.marketplaceOffering.create({
    data: {
      ...data,
      title: options.title || data.title,
      priceMinor: options.price === undefined ? 1500000 : options.price,
      currency: options.currency || 'INR',
      publicationStatus: 'PUBLISHED',
      publishedAt: new Date(),
      lmsEnabled: true,
      courseId: course.id,
    },
  });
  const editor = await marketplaceActor(db),
    pages = new AdminMarketplacePages(db, editor.id);
  const draft = await pages.saveSettings(offering.id, {
    revision: null,
    ...pageSettings,
  });
  await pages.publishPage(offering.id, { revision: draft.revision });
  const intents = new EnrollmentService(db),
    proof = randomBytes(32).toString('hex');
  let intent = await intents.start(options.anonymous ? null : user.id, proof, {
    slug: offering.slug,
  });
  const anonymous = intent;
  if (options.anonymous)
    intent = await intents.claim(intent.ref, user.id, proof, {
      revision: intent.revision,
    });
  for (const fields of m6Steps)
    intent = await intents.saveStep(intent.ref, user.id, {
      revision: intent.revision,
      ...fields,
    });
  const orders = new CommerceOrders(db),
    provider = options.provider || merchants.get(db) || providerFixture(),
    payments = new CommercePayments(db, provider.gateway);
  merchants.set(db, provider);
  const input = {
    intentRef: intent.ref,
    revision: intent.revision,
    termsVersion: fixturePurchasePolicy.version,
    acknowledge: true,
  };
  return {
    user,
    course,
    item,
    offering,
    editor,
    pages,
    intents,
    proof,
    anonymous,
    intent,
    orders,
    provider,
    payments,
    input,
    policy: fixturePurchasePolicy,
    async order() {
      return orders.create(user.id, input, fixturePurchasePolicy);
    },
    async pay() {
      const order = await orders.create(user.id, input, fixturePurchasePolicy);
      const checkout = await payments.open(order.ref, user.id);
      const sessionId = String(checkout.data.providerOrderId);
      provider.payment(sessionId);
      return { order, sessionId };
    },
  };
}
