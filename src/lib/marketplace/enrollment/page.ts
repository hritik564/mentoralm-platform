import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { logUnavailable } from '../../production/request-context';
import { StudentError } from '../../student/errors';
import { intentRefInput } from './validation';
import {
  enrollmentActor,
  enrollmentBrowser,
  enrollmentIdentity,
  enrollmentService,
} from './server';
async function safeRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (e) {
    if (e instanceof StudentError && e.code === 'NOT_FOUND') notFound();
    logUnavailable('STUDENT_API_UNAVAILABLE');
    // eslint-disable-next-line preserve-caught-error -- Raw provider causes can contain private identity/query details; only a safe code is logged.
    throw new Error('Enrollment is temporarily unavailable.');
  }
}
export async function enrollmentPage(ref: string, checkout = false) {
  if (!intentRefInput.safeParse(ref).success) notFound();
  const actor = await safeRead(() => enrollmentActor(false));
  if (!actor)
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/enroll/${ref}`)}`);
  const view = await safeRead(async () =>
    enrollmentService().view(ref, actor.id, await enrollmentBrowser()),
  );
  if (
    checkout &&
    view.access === 'active' &&
    (view.needsClaim ||
      view.state !== 'READY_FOR_CHECKOUT' ||
      !view.completedAt)
  )
    redirect(`/enroll/${ref}`);
  const identity = await safeRead(() => enrollmentIdentity(actor.clerkUserId));
  return { view, identity };
}
