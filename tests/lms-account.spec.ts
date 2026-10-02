import { test, expect } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { localSeedUrl } from '../scripts/lms-owner/safety';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
loadEnvConfig(process.cwd(), true);
test('native LMS Support/Profile, shared persistence, ownership and logout', async ({
  page,
  context,
}) => {
  const url = localSeedUrl(process.env),
    owner = process.env.LMS_UI_OWNER;
  if (!owner)
    throw Error(
      'LMS_UI_OWNER must explicitly identify the existing seeded Development account.',
    );
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const users = owner.startsWith('user_')
    ? [await clerk.users.getUser(owner)]
    : (await clerk.users.getUserList({ emailAddress: [owner], limit: 2 })).data;
  if (users.length !== 1)
    throw Error('Exactly one existing Development identity is required.');
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }, { schema: 'public' }),
  });
  let tokenId: string | undefined,
    testSessionId: string | undefined,
    ownTicketId: string | undefined,
    fixtureUserId: string | undefined;
  let originalProfile: {
    educationLevel: string | null;
    institution: string | null;
    graduationYear: number | null;
    interests: string[];
    careerGoals: string | null;
  } | null = null;
  let profileEdited = false;
  const marker = `LMS support/profile check ${randomUUID()}`;
  try {
    const actor = await db.user.findUniqueOrThrow({
      where: { clerkUserId: users[0].id },
    });
    const ticket = await clerk.signInTokens.createSignInToken({
      userId: users[0].id,
      expiresInSeconds: 180,
    });
    tokenId = ticket.id;
    await page.goto('/sign-in');
    await page.waitForFunction(
      () =>
        !!(window as unknown as { Clerk?: { loaded: boolean } }).Clerk?.loaded,
    );
    testSessionId = await page.evaluate(async (ticket) => {
      const clerk = (
        window as unknown as {
          Clerk: {
            client: {
              signIn: {
                create: (input: {
                  strategy: string;
                  ticket: string;
                }) => Promise<{ createdSessionId: string }>;
              };
            };
            setActive: (input: { session: string }) => Promise<void>;
          };
        }
      ).Clerk;
      const attempt = await clerk.client.signIn.create({
        strategy: 'ticket',
        ticket,
      });
      await clerk.setActive({ session: attempt.createdSessionId });
      return attempt.createdSessionId;
    }, ticket.token);
    originalProfile = await db.studentProfile.findUnique({
      where: { userId: actor.id },
      select: {
        educationLevel: true,
        institution: true,
        graduationYear: true,
        interests: true,
        careerGoals: true,
      },
    });
    await mkdir('docs/reviews/lms-account', { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    async function ready(theme = 'dark') {
      await expect(page.locator('.lms-content h1').first()).toBeVisible();
      await expect(page.locator('.lms-content [aria-busy="true"]')).toHaveCount(
        0,
      );
      await expect(page.locator('.lms-shell')).toHaveAttribute(
        'data-lms-theme',
        theme,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    async function axe() {
      const result = await new AxeBuilder({ page })
        .include('.lms-shell')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      ).toEqual([]);
    }
    await page.goto('/learn');
    await ready();
    await page.getByRole('link', { name: 'Support', exact: true }).click();
    await expect(page).toHaveURL(/\/learn\/support$/);
    await ready();
    expect(new URL(page.url()).pathname).toBe('/learn/support');
    await expect(
      page.getByRole('navigation', { name: 'Learn navigation' }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Create ticket +', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await axe();
    await page
      .getByRole('button', { name: 'Submit ticket', exact: true })
      .click();
    await expect(
      page.getByText('Enter a subject.', { exact: true }),
    ).toBeVisible();
    await page.getByLabel('Subject', { exact: true }).fill(marker);
    await page
      .getByLabel('Message', { exact: true })
      .fill('Local validation ticket. Safe to remove after this test.');
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/lms/account/tickets') &&
        r.request().method() === 'POST',
    );
    await page
      .getByRole('button', { name: 'Submit ticket', exact: true })
      .click();
    ownTicketId = ((await (await created).json()) as { id: string }).id;
    await expect(
      page.getByRole('heading', { name: marker, exact: true }),
    ).toBeVisible();
    await ready();
    await axe();
    await page
      .getByLabel('Reply', { exact: true })
      .fill('Local student follow-up.');
    await page.getByRole('button', { name: 'Send reply', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Reply saved.' }),
    ).toBeVisible();
    await expect(
      page
        .locator('.lms-ticket-messages')
        .getByText('Local student follow-up.', { exact: true }),
    ).toBeVisible();
    const persisted = await db.supportTicket.findFirstOrThrow({
      where: { id: ownTicketId, userId: actor.id },
      include: { messages: true },
    });
    expect(persisted.messages.length).toBe(2);
    await page.goto('/dashboard/support');
    await expect(
      page.getByRole('button', { name: marker, exact: true }),
    ).toBeVisible();
    await page.goto('/learn/profile');
    await ready();
    const identity = await db.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: { studentId: true },
    });
    await expect(
      page.getByText(identity.studentId!, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('CareerIgnite OCT-26', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Edit education & career', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await axe();
    await page.getByLabel('Institution', { exact: true }).fill(marker);
    await page
      .getByRole('button', { name: 'Save profile', exact: true })
      .click();
    profileEdited = true;
    await expect(page.getByText(marker, { exact: true })).toBeVisible();
    expect(
      (
        await db.studentProfile.findUniqueOrThrow({
          where: { userId: actor.id },
        })
      ).institution,
    ).toBe(marker);
    await page.goto('/dashboard/profile');
    await expect(page.getByText(marker, { exact: true })).toBeVisible();
    await page.goto('/learn/profile');
    await ready();
    for (const theme of ['dark', 'light']) {
      if (theme === 'light')
        await page
          .getByRole('button', { name: 'Dark mode', exact: true })
          .click();
      for (const [name, path] of [
        ['profile', '/learn/profile'],
        ['support', '/learn/support'],
        ['conversation', `/learn/support/${ownTicketId}`],
      ]) {
        await page.goto(path);
        await ready(theme);
        await axe();
        if (name !== 'conversation')
          await page.screenshot({
            path: `docs/reviews/lms-account/1440-${name}-${theme}.png`,
            fullPage: true,
          });
        expect(new URL(page.url()).pathname).toBe(path);
      }
    }
    for (const width of [820, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, path] of [
        ['profile', '/learn/profile'],
        ['conversation', `/learn/support/${ownTicketId}`],
      ]) {
        await page.goto(path);
        await ready('light');
        await axe();
        if (width === 390)
          await page.screenshot({
            path: `docs/reviews/lms-account/390-${name}-light.png`,
            fullPage: true,
          });
      }
    }
    await page.goto('/learn/profile');
    await ready('light');
    await page
      .getByRole('button', { name: 'Manage account & security', exact: true })
      .click();
    await expect(page.locator('.cl-userProfile-root')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto('/learn/profile');
    await ready('light');
    const account = page.getByRole('button', { name: /Open account menu for/ });
    await account.click();
    await expect(
      page
        .locator('.lms-account-menu')
        .getByRole('link', { name: 'Profile', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(account).toBeFocused();
    await account.click();
    await axe();
    await page
      .locator('.lms-account-menu')
      .getByRole('link', { name: 'Support', exact: true })
      .click();
    await expect(page).toHaveURL(/\/learn\/support$/);
    await ready('light');
    expect(new URL(page.url()).pathname).toBe('/learn/support');
    // API ownership and input boundaries; no existing owner records are modified.
    const outsider = await db.user.create({
      data: { clerkUserId: `local_account_idor_${randomUUID()}` },
    });
    fixtureUserId = outsider.id;
    const foreign = await db.supportTicket.create({
      data: {
        userId: outsider.id,
        reference: `MT-TEST-${randomUUID()}`,
        category: 'General',
        subject: 'Foreign private fixture',
      },
    });
    expect(
      (
        await context.request.get(`/api/lms/account/tickets/${foreign.id}`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await context.request.post(
          `/api/lms/account/tickets/${foreign.id}/reply`,
          {
            headers: { Origin: 'http://127.0.0.1:3000' },
            data: { message: 'Must be denied' },
          },
        )
      ).status(),
    ).toBe(404);
    await page.goto(`/learn/support/${foreign.id}`);
    await expect(
      page.getByRole('heading', { name: 'Ticket unavailable', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Foreign private fixture', { exact: true }),
    ).toHaveCount(0);
    const headers = { Origin: 'http://127.0.0.1:3000' };
    expect(
      (
        await context.request.post(
          `/api/lms/account/tickets/${ownTicketId}/reply`,
          { headers, data: { message: 'Spoof', actor: 'STAFF' } },
        )
      ).status(),
    ).toBe(400);
    expect(
      (
        await context.request.patch('/api/lms/account/profile', {
          headers,
          data: {
            educationLevel: null,
            institution: null,
            graduationYear: null,
            interests: [],
            careerGoals: null,
            userId: outsider.id,
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await context.request.patch('/api/lms/account/profile', {
          headers: { Origin: 'https://evil.example' },
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (await context.request.get('/api/lms/account/courses')).status(),
    ).toBe(404);
    await db.supportTicket.update({
      where: { id: ownTicketId },
      data: { status: 'CLOSED' },
    });
    await page.goto(`/learn/support/${ownTicketId}`);
    await ready('light');
    await expect(page.getByLabel('Reply', { exact: true })).toHaveCount(0);
    expect(
      (
        await context.request.post(
          `/api/lms/account/tickets/${ownTicketId}/reply`,
          { headers, data: { message: 'Closed reply' } },
        )
      ).status(),
    ).toBe(409);
    // Restore the exact profile through the same shared API before logout.
    const restored = await context.request.patch('/api/lms/account/profile', {
      headers,
      data: originalProfile || {
        educationLevel: null,
        institution: null,
        graduationYear: null,
        interests: [],
        careerGoals: null,
      },
    });
    expect(restored.status()).toBe(200);
    profileEdited = false;
    if (!originalProfile)
      await db.studentProfile.deleteMany({
        where: {
          userId: actor.id,
          institution: null,
          educationLevel: null,
          graduationYear: null,
          careerGoals: null,
          interests: { isEmpty: true },
        },
      });
    await page.getByRole('button', { name: /Open account menu for/ }).click();
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    expect(
      (await context.request.get('/api/lms/account/profile')).status(),
    ).toBe(401);
    await page.goto('/learn/profile');
    await expect(page).toHaveURL(/\/sign-in/);
    expect(errors).toEqual([]);
    console.log(
      'Native Support/Profile, shared records/edits, Student ID/Batch, both themes, responsive/axe, IDOR, strict mutations, closed replies and real logout passed.',
    );
  } finally {
    const actor = await db.user.findUniqueOrThrow({
      where: { clerkUserId: users[0].id },
    });
    if (profileEdited) {
      const current = await db.studentProfile.findUnique({
        where: { userId: actor.id },
      });
      // Guard rollback against another tab changing the owner's profile concurrently.
      if (current?.institution === marker) {
        if (originalProfile)
          await db.studentProfile.update({
            where: { userId: actor.id },
            data: originalProfile,
          });
        else await db.studentProfile.delete({ where: { userId: actor.id } });
      }
    }
    if (ownTicketId)
      await db.supportTicket.deleteMany({
        where: { id: ownTicketId, userId: actor.id, subject: marker },
      });
    if (fixtureUserId)
      await db.user.deleteMany({
        where: {
          id: fixtureUserId,
          clerkUserId: { startsWith: 'local_account_idor_' },
        },
      });
    if (testSessionId)
      await clerk.sessions.revokeSession(testSessionId).catch(() => {});
    if (tokenId)
      await clerk.signInTokens.revokeSignInToken(tokenId).catch(() => {});
    await db.$disconnect();
  }
});
