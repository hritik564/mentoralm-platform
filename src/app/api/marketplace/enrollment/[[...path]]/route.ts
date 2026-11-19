import { withRequestContext } from '@/lib/production/request-context';
import { mutationLimiter } from '@/lib/student/abuse';
import { privateJson, requestBody } from '@/lib/student/http';
import { StudentError } from '@/lib/student/errors';
import {
  enrollmentActor,
  enrollmentBrowser,
  enrollmentResponse,
  enrollmentService,
} from '@/lib/marketplace/enrollment/server';
export const dynamic = 'force-dynamic';
async function route(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  return withRequestContext(request, () =>
    enrollmentResponse(async () => {
      const path = (await params).path || [],
        [ref, action] = path;
      if (request.method === 'POST' && path.length === 0) {
        const body = await requestBody(request),
          actor = await enrollmentActor(false),
          proof = await enrollmentBrowser(true);
        if (!proof) throw new StudentError('UNAVAILABLE');
        // Per-identity admission precedes the high emergency circuit breaker.
        await mutationLimiter.check(actor?.id || proof, 'marketplace-start');
        if (!actor)
          await mutationLimiter.check(
            'anonymous-enrollment-global',
            'marketplace-anonymous',
          );
        const view = await enrollmentService().start(
            actor?.id || null,
            proof,
            body,
          ),
          destination = `/enroll/${view.ref}`;
        return privateJson({
          ref: view.ref,
          destination: actor
            ? destination
            : `/sign-in?redirect_url=${encodeURIComponent(destination)}`,
        });
      }
      const actor = await enrollmentActor();
      if (!actor) throw new StudentError('UNAUTHENTICATED');
      const service = enrollmentService();
      if (request.method === 'GET' && path.length === 1)
        return privateJson(
          await service.view(ref, actor.id, await enrollmentBrowser()),
        );
      if (request.method !== 'POST' || path.length !== 2)
        throw new StudentError('NOT_FOUND');
      const body = await requestBody(request);
      await mutationLimiter.check(actor.id, 'marketplace-onboarding');
      if (action === 'claim')
        return privateJson(
          await service.claim(ref, actor.id, await enrollmentBrowser(), body),
        );
      if (action === 'steps')
        return privateJson(await service.saveStep(ref, actor.id, body));
      if (action === 'cancel')
        return privateJson(await service.cancel(ref, actor.id, body));
      throw new StudentError('NOT_FOUND');
    }),
  );
}
export { route as GET, route as POST };
