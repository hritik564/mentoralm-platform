import { test, expect, type Page } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { testDatabaseUrl } from './helpers/d4-database';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
loadEnvConfig(process.cwd(), true);
const origin = 'http://127.0.0.1:3103';
type Fixture = {
  schema: string;
  ownerClerkId: string;
  studentClerkId: string;
  ownerId: string;
  studentId: string;
  courseId: string;
  lessonId: string;
  refs: Record<string, string>;
};
test('A3 anonymous operations and unapproved host fail closed', async ({
  page,
  request,
}) => {
  await page.goto('/admin/attendance');
  await expect(page).toHaveURL(/admin-auth\/sign-in/);
  for (const area of [
    'overview',
    'attendance',
    'submissions',
    'attempts',
    'certificates',
    'discussions',
    'support',
    'communications',
    'referrals',
  ]) {
    expect((await request.get(`/api/admin/operations/${area}`)).status()).toBe(
      401,
    );
  }
  expect(
    (
      await request.get('/api/admin/operations/support', {
        headers: { host: 'attacker.test' },
      })
    ).status(),
  ).toBe(400);
});
test('A3 real owner operations, student denial, forms, immutable history, consent, both themes and responsive accessibility', async ({
  page,
  context,
  browser,
}) => {
  const f = JSON.parse(
    await readFile('docs/reviews/admin-a3/fixture.json', 'utf8'),
  ) as Fixture;
  if (
    !/^d4_[a-f0-9]{24}$/.test(f.schema) ||
    f.schema !== process.env.A3_TEST_SCHEMA
  )
    throw Error('Isolated schema mismatch');
  const db = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString: testDatabaseUrl()! },
        { schema: f.schema },
      ),
    }),
    clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }),
    sessions: string[] = [],
    tokens: string[] = [];
  async function signIn(target: Page, userId: string) {
    await target.goto('/admin-auth/sign-in');
    await target.waitForFunction(
      () =>
        !!(window as unknown as { Clerk?: { loaded: boolean } }).Clerk?.loaded,
    );
    const token = await clerk.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 180,
    });
    tokens.push(token.id);
    const session = await target.evaluate(async (ticket) => {
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
      const s = await c.client.signIn.create({ strategy: 'ticket', ticket });
      await c.setActive({ session: s.createdSessionId });
      return s.createdSessionId;
    }, token.token);
    sessions.push(session);
  }
  async function get<T>(path: string): Promise<T> {
    const r = await page.request.get(`/api/admin/operations/${path}`);
    expect(r.status(), `${path}: ${await r.text()}`).toBe(200);
    return (await r.json()) as T;
  }
  async function post(
    path: string,
    body: unknown,
    status = 200,
    headers = { origin },
  ) {
    const r = await page.request.post(`/api/admin/operations/${path}`, {
      data: body,
      headers,
    });
    expect(r.status(), `${path}: ${await r.text()}`).toBe(status);
    return r;
  }
  async function capture(name: string, axe = true) {
    await expect(page.locator('.admin-shell')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page
        .locator('dialog[open]')
        .evaluateAll((ds) =>
          ds.every((d) => d.scrollWidth <= d.clientWidth + 1),
        ),
    ).toBe(true);
    if (axe)
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `docs/reviews/admin-a3/${name}.png` });
  }
  async function close() {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  try {
    await signIn(page, f.ownerClerkId);
    const responsesBefore = JSON.stringify(
      await db.academicResponse.findMany({
        orderBy: { position: 'asc' },
        include: { options: true },
      }),
    );
    // All queues and detail views contain real isolated PostgreSQL records.
    for (const theme of ['light', 'dark']) {
      await context.addCookies([
        { name: 'mentoralm-product-theme', value: theme, url: origin },
      ]);
      await page.goto('/admin');
      await expect(
        page.getByRole('heading', { name: 'Operations queues' }),
      ).toBeVisible();
      await expect(
        page.getByText('Pending text reviews', { exact: true }),
      ).toBeVisible();
      await capture(`1440-overview-${theme}`);
      for (const area of [
        'attendance',
        'submissions',
        'attempts',
        'certificates',
        'discussions',
        'support',
        'communications',
        'referrals',
      ]) {
        const list = await get<{ rows: { ref: string }[]; total: number }>(
          area,
        );
        expect(list.total).toBe(1);
        expect(list.rows[0].ref).toBe(f.refs[area]);
        await page.goto(`/admin/${area}`);
        await expect(page.locator('tbody tr')).toHaveCount(1);
        await expect(page.locator('.admin-shell')).toHaveAttribute(
          'data-admin-theme',
          theme,
        );
        await capture(`1440-${area}-queue-${theme}`);
        await page.goto(`/admin/${area}/${f.refs[area]}`);
        await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(
          /^(Session attendance|Assignment submission|Attempt review|Certificate|Discussion thread|Support ticket|Communication plan|Referral identity)$/,
        );
        await expect(page.getByText('Loading workspace…')).toHaveCount(0);
        await capture(`1440-${area}-${theme}`);
      }
    }
    // Attendance UI and audited correction.
    await page.goto(`/admin/attendance/${f.refs.attendance}`);
    await page.getByRole('button', { name: 'Select this page' }).click();
    await page.getByRole('button', { name: 'Mark selected ABSENT' }).click();
    await page
      .getByLabel('Entry / correction reason')
      .fill('Confirmed missed original session');
    await page
      .getByRole('button', { name: 'Save selected attendance' })
      .click();
    await expect(page.getByText('1 saved', { exact: false })).toBeVisible();
    expect((await db.attendanceRecord.findFirstOrThrow()).status).toBe(
      'ABSENT',
    );
    // Assignment latest-version review and private download.
    await page.goto(`/admin/submissions/${f.refs.submissions}`);
    const download = await page.request.get(
      (await page
        .getByRole('link', { name: 'practice-notes.txt' })
        .getAttribute('href')) ?? '',
    );
    expect(download.status()).toBe(200);
    expect(download.headers()['cache-control']).toContain('no-store');
    expect(await download.text()).toBe('Private A3 practice notes');
    await page.getByRole('button', { name: 'Review latest version' }).click();
    await page.getByLabel('Review outcome').selectOption('ACCEPTED');
    await page
      .getByLabel('Assignment feedback')
      .fill('Clear and well structured.');
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Clear and well structured.')).toBeVisible();
    // Text outcomes, keyboard dialog trapping, correction, immutable answers.
    await page.goto(`/admin/attempts/${f.refs.attempts}`);
    const trigger = page
      .getByRole('button', { name: 'Review text response', exact: true })
      .first();
    await trigger.click();
    await page.getByRole('button', { name: 'Close dialog' }).focus();
    await page.keyboard.press('Shift+Tab');
    expect(
      await page
        .getByRole('dialog')
        .evaluate((d) => d.contains(document.activeElement)),
    ).toBe(true);
    await close();
    await expect(trigger).toBeFocused();
    for (let i = 0; i < 2; i++) {
      await page
        .getByRole('button', { name: 'Review text response', exact: true })
        .first()
        .click();
      await page.getByLabel('Awarded points').fill('1');
      await page
        .getByLabel('Review feedback (optional)')
        .fill('Good reflection.');
      await page
        .getByRole('button', { name: 'Save changes', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Review text response', exact: true }),
      ).toHaveCount(1 - i);
    }
    await expect(page.getByText('REVIEWED', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Correct review' }).first().click();
    await page.getByLabel('Awarded points').fill('0');
    await page
      .getByLabel('Review feedback (optional)')
      .fill('Corrected with a clearer point requirement.');
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(
      JSON.stringify(
        await db.academicResponse.findMany({
          orderBy: { position: 'asc' },
          include: { options: true },
        }),
      ),
    ).toBe(responsesBefore);
    expect(await db.academicResponseReview.count()).toBe(2);
    // Certificate hold/restore/revoke uses current eligibility; no completion fabrication.
    await page.goto(`/admin/certificates/${f.refs.certificates}`);
    for (const button of [
      'Suspend certificate',
      'Restore / recheck eligibility',
    ]) {
      await page.getByRole('button', { name: button, exact: true }).click();
      await page
        .getByLabel('Certificate action reason')
        .fill('A3 owner policy check');
      await page
        .getByRole('button', { name: 'Save changes', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect((await db.certificate.findFirstOrThrow()).status).toBe('ACTIVE');
    await db.lessonState.update({
      where: { userId_itemId: { userId: f.studentId, itemId: f.lessonId } },
      data: { completedAt: null },
    });
    await post(`certificates/${f.refs.certificates}/state`, {
      action: 'RESTORE',
      reason: 'Recheck ineligible result',
    });
    expect((await db.certificate.findFirstOrThrow()).status).toBe('SUSPENDED');
    await post(`certificates/${f.refs.certificates}/state`, {
      action: 'REVOKE',
      reason: 'Terminal test revocation',
    });
    await post(
      `certificates/${f.refs.certificates}/state`,
      { action: 'RESTORE', reason: 'Cannot un-revoke' },
      409,
    );
    // Discussion lock only; original Student post survives.
    await page.goto(`/admin/discussions/${f.refs.discussions}`);
    await page
      .getByRole('button', { name: 'Lock thread', exact: true })
      .click();
    await page.getByLabel('Moderation reason').fill('Review conduct');
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Unlock thread', exact: true }),
    ).toBeVisible();
    expect((await db.discussionPost.findFirstOrThrow()).authorId).toBe(
      f.studentId,
    );
    // Staff actor is server-derived; ticket Student ownership unchanged.
    await page.goto(`/admin/support/${f.refs.support}`);
    await page.getByLabel('Ticket status').selectOption('IN_PROGRESS');
    await page
      .getByLabel('Admin reply (optional)')
      .fill('Open the version history and choose your private attachment.');
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(
      page.getByText(
        'Open the version history and choose your private attachment.',
      ),
    ).toBeVisible();
    expect(
      (await db.supportMessage.findFirstOrThrow({ where: { actor: 'STAFF' } }))
        .senderId,
    ).toBe(f.ownerId);
    expect((await db.supportTicket.findFirstOrThrow()).userId).toBe(
      f.studentId,
    );
    // Consent preview and plan, without real sends or recipients supplied by client.
    await page.goto('/admin/communications/new');
    await page
      .getByLabel('Batch audience')
      .selectOption({ label: 'Academic cohort a3browser' });
    await page.getByLabel('Purpose', { exact: true }).selectOption('MARKETING');
    await page
      .getByRole('button', { name: 'Preview resolved audience' })
      .click();
    await expect(page.getByText('1 members', { exact: false })).toBeVisible();
    await page
      .getByLabel('Subject', { exact: true })
      .fill('A3 owner reviewed plan');
    await page
      .getByLabel('Communication body')
      .fill(
        'A test plan with explicit consent checks and no sending provider.',
      );
    await page
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(page).toHaveURL(/admin\/communications\/[a-zA-Z0-9_-]+$/);
    await expect(
      page.getByText(
        'Provider unavailable. These are delivery plans; no message has been sent.',
      ),
    ).toBeVisible();
    expect(
      await db.communicationDelivery.count({ where: { status: 'SUPPRESSED' } }),
    ).toBe(2);
    // Browser trust boundaries.
    const attempt = await get<{
        courseRef: string;
        itemRef: string;
        student: { ref: string };
        responses: { ref: string }[];
      }>(`attempts/${f.refs.attempts}`),
      payload = {
        courseId: attempt.courseRef,
        itemId: attempt.itemRef,
        userId: attempt.student.ref,
        responseId: attempt.responses[1].ref,
        awardedPoints: 1,
        feedback: null,
      };
    await post(
      `attempts/${f.refs.attempts}/review`,
      { ...payload, userId: f.refs.other },
      404,
    );
    await post(
      `attempts/${f.refs.attempts}/review`,
      { ...payload, responseId: attempt.responses[0].ref },
      409,
    );
    await post(
      `attempts/${f.refs.attempts}/review`,
      { ...payload, awardedPoints: 2 },
      400,
    );
    await post(
      `attempts/${f.refs.attempts}/review`,
      { ...payload, actorId: f.ownerId },
      400,
    );
    await post(`attempts/${f.refs.attempts}/review`, payload, 403, {
      origin: 'https://attacker.test',
    });
    await post('communications/plan', { recipients: [f.studentId] }, 400);
    await post(`referrals/${f.refs.referrals}/change`, {}, 404);
    expect(
      (
        await page.request.get(
          `/api/admin/operations/support/${f.refs.attempts}`,
        )
      ).status(),
    ).toBe(404);
    await post(
      `support/${f.refs.support}/reply`,
      { status: 'OPEN', body: 'x'.repeat(17000) },
      400,
    );
    for (const width of [1024, 820, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const area of [
        'attendance',
        'submissions',
        'attempts',
        'certificates',
        'discussions',
        'support',
        'communications',
        'referrals',
      ]) {
        await page.goto(`/admin/${area}`);
        await expect(page.getByText('Loading workspace…')).toHaveCount(0);
        await capture(`${width}-${area}-queue-dark`, width === 820);
      }
      await page.goto(`/admin/attempts/${f.refs.attempts}`);
      await page
        .getByRole('button', { name: 'Correct review' })
        .first()
        .click();
      await capture(`${width}-review-dialog-dark`);
      await close();
    }
    const deniedContext = await browser.newContext({ baseURL: origin }),
      denied = await deniedContext.newPage();
    try {
      await signIn(denied, f.studentClerkId);
      await denied.goto('/admin');
      await expect(
        denied.getByRole('heading', { name: 'Access Denied' }),
      ).toBeVisible();
      expect(new URL(denied.url()).pathname).toBe('/admin');
      for (const area of [
        'attendance',
        'submissions',
        'attempts',
        'certificates',
        'discussions',
        'support',
        'communications',
        'referrals',
      ]) {
        expect(
          (await denied.request.get(`/api/admin/operations/${area}`)).status(),
        ).toBe(403);
        expect(
          (
            await denied.request.get(
              `/api/admin/operations/${area}/${f.refs[area]}`,
            )
          ).status(),
        ).toBe(403);
      }
      expect(
        (
          await denied.request.get(
            await page.request
              .get(`/api/admin/operations/submissions/${f.refs.submissions}`)
              .then(async (r) => {
                const s = (await r.json()) as {
                  versions: { files: { ref: string }[] }[];
                };
                return `/api/admin/operations/submissions/${f.refs.submissions}/files/${s.versions[0].files[0].ref}`;
              }),
          )
        ).status(),
      ).toBe(403);
      expect(
        (
          await denied.request.post(
            `/api/admin/operations/attempts/${f.refs.attempts}/review`,
            { data: payload, headers: { origin } },
          )
        ).status(),
      ).toBe(403);
    } finally {
      await deniedContext.close();
    }
    await db.userRoleAssignment.deleteMany({
      where: { userId: f.ownerId, role: 'ADMIN' },
    });
    expect(
      (await page.request.get('/api/admin/operations/overview')).status(),
    ).toBe(403);
    // Restore only the disposable Test fixture for the independent account-switch case.
    await db.userRoleAssignment.create({
      data: { userId: f.ownerId, role: 'ADMIN' },
    });
  } finally {
    for (const id of sessions)
      await clerk.sessions.revokeSession(id).catch(() => {});
    for (const id of tokens)
      await clerk.signInTokens.revokeSignInToken(id).catch(() => {});
    await db.$disconnect();
  }
});
