import { createClerkClient } from '@clerk/backend';
/** Exact existing Development identity. Never creates a Clerk identity or MentoraLM User. */
export async function resolveExistingClerkIdentity(identity: string) {
  if (!process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'))
    throw Error('Development Clerk key required.');
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  if (/^user_[a-zA-Z0-9]+$/.test(identity))
    return (await clerk.users.getUser(identity)).id;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity))
    throw Error('Exact email or Clerk user ID required.');
  const users = (
    await clerk.users.getUserList({ emailAddress: [identity], limit: 2 })
  ).data.filter((u) =>
    u.emailAddresses.some(
      (e) => e.emailAddress.toLowerCase() === identity.toLowerCase(),
    ),
  );
  if (users.length !== 1)
    throw Error('Expected exactly one existing Clerk Development identity.');
  return users[0].id;
}
