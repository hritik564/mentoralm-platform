import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'node:crypto';
import { getDatabase } from '../../db/client';
import { isAuthConfigured } from '../../auth/config';
import { provisionUser } from '../../student/repository';
import { StudentError, errorStatus } from '../../student/errors';
import { platformEnvironment } from '../../production/config';
import { logUnavailable } from '../../production/request-context';
import { browserSecretInput } from './validation';
import { EnrollmentService } from './service';
export function enrollmentService() {
  return new EnrollmentService(getDatabase());
}
export function browserHash(secret: string) {
  return createHash('sha256')
    .update(`mentoralm-enrollment:${secret}`)
    .digest('hex');
}
export async function enrollmentBrowser(create = false) {
  const jar = await cookies(),
    secure = platformEnvironment() === 'production',
    name = secure ? '__Host-mentoralm-enrollment' : 'mentoralm-enrollment';
  let secret = jar.get(name)?.value;
  if (!secret || !browserSecretInput.safeParse(secret).success) {
    if (!create) return null;
    secret = randomBytes(32).toString('base64url');
  }
  // A later start must keep its proof alive for that intent's full lifetime.
  // Refreshing the cookie never extends any server-owned quote expiry.
  if (create) {
    jar.set(name, secret, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });
  }
  return browserHash(secret);
}
export async function enrollmentActor(required = true) {
  if (!isAuthConfigured()) throw new StudentError('UNAVAILABLE');
  const { userId } = await auth();
  if (!userId) {
    if (required) throw new StudentError('UNAUTHENTICATED');
    return null;
  }
  const actor = await provisionUser(getDatabase(), userId);
  return { ...actor, clerkUserId: userId };
}
export async function enrollmentIdentity(clerkUserId: string) {
  const user = await currentUser();
  if (!user || user.id !== clerkUserId)
    throw new StudentError('UNAUTHENTICATED');
  return {
    name: user.fullName || '',
    phone:
      user.phoneNumbers.find(
        (p) =>
          p.id === user.primaryPhoneNumberId &&
          p.verification?.status === 'verified',
      )?.phoneNumber || '',
    email:
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress || '',
  };
}
export async function enrollmentResponse(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (e) {
    const code = e instanceof StudentError ? e.code : 'UNAVAILABLE';
    if (code === 'UNAVAILABLE') logUnavailable('STUDENT_API_UNAVAILABLE');
    return Response.json(
      {
        error:
          code === 'INVALID_INPUT'
            ? 'Review your details and use plain text within the allowed limits.'
            : code === 'CONFLICT'
              ? 'This enrollment changed or is no longer available. Reload to continue.'
              : code === 'RATE_LIMITED'
                ? 'Please wait a moment before trying again.'
                : code === 'UNAUTHENTICATED'
                  ? 'Sign in to continue.'
                  : code === 'NOT_FOUND'
                    ? 'This enrollment is not available.'
                    : 'Enrollment is temporarily unavailable.',
      },
      {
        status: errorStatus[code],
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  }
}
