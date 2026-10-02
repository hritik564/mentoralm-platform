import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { isAuthConfigured } from './config';

/** Protected content checks identity at the server boundary, independently of the proxy. */
const studentIdentity = cache(async () => {
  if (!isAuthConfigured()) return null;
  const session = await auth();
  if (!session.userId) return null;
  const user = await currentUser();
  if (!user || user.id !== session.userId) return null;
  return {
    name: user.fullName || user.username || '',
    firstName: user.firstName,
    email:
      user.emailAddresses.find(
        (email) => email.id === user.primaryEmailAddressId,
      )?.emailAddress || '',
    imageUrl: user.hasImage ? user.imageUrl : null,
  };
});

/** Callers can select a fixed native entry route; identity lookup stays shared per render. */
export const requireStudentIdentity = cache(async (signInPath = '/sign-in') => {
  const identity = await studentIdentity();
  if (!identity) redirect(signInPath);
  return identity;
});
