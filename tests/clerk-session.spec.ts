import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createClerkClient } from '@clerk/backend';
import { signInTestAccount, signOutTestAccount } from './helpers/clerk-session';
test('Development account switch waits for actual Clerk logout and server denial', async ({
  page,
}) => {
  test.setTimeout(60000);
  const f = JSON.parse(
      await readFile('docs/reviews/admin-a3/fixture.json', 'utf8'),
    ) as { ownerClerkId: string; studentClerkId: string },
    clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  let ownerSession: string | undefined;
  try {
    await test.step('Sign in fixture Student', async () => {
      await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
      await signInTestAccount(page, f.studentClerkId);
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByRole('heading', { name: /Welcome/ }),
      ).toBeVisible();
      expect((await page.request.get('/api/student/profile')).status()).toBe(
        200,
      );
    });
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
    const studentSession = await page.evaluate(
      () =>
        (window as unknown as { Clerk: { session: { id: string } } }).Clerk
          .session.id,
    );
    await test.step('SDK logout completes and server refuses former session', async () => {
      await signOutTestAccount(page);
      await expect
        .poll(
          async () => (await page.request.get('/api/student/profile')).status(),
          { timeout: 10000 },
        )
        .toBe(401);
      expect(['ended', 'removed']).toContain(
        (await clerk.sessions.getSession(studentSession)).status,
      );
    });
    await test.step('Sign in second identity after teardown', async () => {
      await signInTestAccount(page, f.ownerClerkId);
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByRole('heading', { name: 'Operations queues' }),
      ).toBeVisible();
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
      ownerSession = await page.evaluate(
        () =>
          (window as unknown as { Clerk: { session: { id: string } } }).Clerk
            .session.id,
      );
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { Clerk: { user: { id: string } } }).Clerk
              .user.id,
        ),
      ).toBe(f.ownerClerkId);
      expect(
        (await page.request.get('/api/admin/operations/overview')).status(),
      ).toBe(200);
    });
  } finally {
    if (ownerSession) await clerk.sessions.revokeSession(ownerSession);
  }
});
