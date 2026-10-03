import type { Page } from '@playwright/test';
import { createClerkClient } from '@clerk/backend';
/** Real Development session for a fixture account; no password or alternative auth system. */
export async function signInTestAccount(page: Page, userId: string) {
  if (!process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'))
    throw Error('Clerk Development required');
  await page.waitForFunction(
    () =>
      !!(window as unknown as { Clerk?: { loaded: boolean } }).Clerk?.loaded,
  );
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }),
    token = await clerk.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 180,
    });
  try {
    await page.evaluate(async (ticket) => {
      const c = (
        window as unknown as {
          Clerk: {
            client: {
              signIn: {
                create(p: {
                  strategy: string;
                  ticket: string;
                }): Promise<{ createdSessionId: string }>;
              };
            };
            setActive(p: { session: string }): Promise<void>;
          };
        }
      ).Clerk;
      const result = await c.client.signIn.create({
        strategy: 'ticket',
        ticket,
      });
      await c.setActive({ session: result.createdSessionId });
    }, token.token);
    await page.waitForFunction(
      (expectedUser) => {
        const c = (
          window as unknown as {
            Clerk?: {
              loaded: boolean;
              session?: { id: string };
              user?: { id: string };
            };
          }
        ).Clerk;
        return c?.loaded && !!c.session?.id && c.user?.id === expectedUser;
      },
      userId,
      { timeout: 15000 },
    );
  } finally {
    await clerk.signInTokens.revokeSignInToken(token.id).catch(() => {});
  }
}
export async function signOutTestAccount(page: Page) {
  // SSR can render before the newly loaded Clerk browser client has its session.
  await page.waitForFunction(
    () => {
      const c = (
        window as unknown as {
          Clerk?: { loaded: boolean; session?: { id: string } };
        }
      ).Clerk;
      return c?.loaded && !!c.session?.id;
    },
    null,
    { timeout: 15000 },
  );
  await page.evaluate(async () => {
    await (
      window as unknown as {
        Clerk: { signOut(options: { redirectUrl: string }): Promise<void> };
      }
    ).Clerk.signOut({ redirectUrl: '/sign-in' });
  });
  await page.waitForURL('**/sign-in', {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForFunction(
    () =>
      (window as unknown as { Clerk?: { loaded: boolean; user: unknown } })
        .Clerk?.loaded &&
      (window as unknown as { Clerk: { user: unknown } }).Clerk.user === null,
    null,
    { timeout: 15000 },
  );
}

/** Wait for the browser session after a full navigation before cookie-based API probes. */
export async function refreshTestSession(page: Page) {
  await page.waitForFunction(
    () => {
      const c = (
        window as unknown as {
          Clerk?: { loaded: boolean; session?: { id: string } };
        }
      ).Clerk;
      return c?.loaded && !!c.session?.id;
    },
    null,
    { timeout: 15000 },
  );
  await page.evaluate(async () => {
    const c = (
      window as unknown as {
        Clerk: {
          session: {
            getToken(p: { skipCache: boolean }): Promise<string | null>;
          };
        };
      }
    ).Clerk;
    if (!(await c.session.getToken({ skipCache: true })))
      throw Error('Expected authenticated fixture session');
  });
}
