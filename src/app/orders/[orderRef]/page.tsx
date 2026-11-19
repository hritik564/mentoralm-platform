import { notFound, redirect } from 'next/navigation';
import { EnrollmentShell } from '@/components/marketplace/enrollment/EnrollmentShell';
import { OrderStatus } from '@/components/marketplace/commerce/OrderStatus';
import { enrollmentActor } from '@/lib/marketplace/enrollment/server';
import { commerceOrders } from '@/lib/marketplace/commerce/server';
import { intentRefInput } from '@/lib/marketplace/enrollment/validation';
import { StudentError } from '@/lib/student/errors';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Payment status',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};
export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderRef: string }>;
}) {
  const { orderRef } = await params;
  if (!intentRefInput.safeParse(orderRef).success) notFound();
  const actor = await enrollmentActor(false);
  if (!actor)
    redirect(
      `/sign-in?redirect_url=${encodeURIComponent(`/orders/${orderRef}`)}`,
    );
  let order;
  try {
    order = await commerceOrders().view(orderRef, actor.id);
  } catch (e) {
    if (e instanceof StudentError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }
  return (
    <EnrollmentShell>
      <OrderStatus initial={order} />
    </EnrollmentShell>
  );
}
