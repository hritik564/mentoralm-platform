import 'server-only';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { isAuthConfigured } from './config';

/** Protected content checks identity at the server boundary, independently of the proxy. */
export const requireStudentIdentity = cache(async () => {
  if (!isAuthConfigured()) redirect('/sign-in');
  const session = await auth();
  if (!session.userId) redirect('/sign-in');
  const user = await currentUser();
  if (!user || user.id !== session.userId) redirect('/sign-in');
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
