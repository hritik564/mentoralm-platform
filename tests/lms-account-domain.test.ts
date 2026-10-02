import test from 'node:test';
import assert from 'node:assert/strict';
import { isolatedDatabase } from './helpers/d4-database';
import {
  provisionUser,
  StudentRepository,
} from '../src/lib/student/repository';
import { LmsRepository } from '../src/lib/lms/repository';
import {
  domainRoute,
  lmsHref,
  lmsInternalPath,
} from '../src/lib/platform/domains';
import { dashboardDestination } from '../src/lib/auth/redirects';
test('native account paths preserve approved LMS host routing and safe login return', () => {
  const origins = {
    website: 'https://mentoralm.com',
    lms: 'https://students.mentoralm.com',
  };
  for (const short of ['/support', '/profile', '/support/ticket_123']) {
    assert.equal(lmsInternalPath(short), `/learn${short}`);
    assert.equal(
      lmsHref(short, origins),
      `https://students.mentoralm.com${short}`,
    );
    assert.deepEqual(domainRoute('students.mentoralm.com', short, origins), {
      kind: 'rewrite',
      path: `/learn${short}`,
    });
  }
  assert.equal(
    dashboardDestination('/learn/support/ticket_123'),
    lmsHref('/learn/support/ticket_123'),
  );
  assert.equal(
    dashboardDestination('/learn/profile'),
    lmsHref('/learn/profile'),
  );
  assert.equal(lmsInternalPath('/support/a/other'), null);
  assert.equal(lmsInternalPath('/profile/other_student'), null);
  assert.equal(
    dashboardDestination('/learn/support/a?owner=other'),
    '/dashboard',
  );
});
test('shared Support/Profile ownership, strict writes, closed replies and LMS entitlement remain authoritative', async () => {
  const fixture = await isolatedDatabase();
  try {
    const a = await provisionUser(fixture.db, 'local_lms_account_actor_a');
    const b = await provisionUser(fixture.db, 'local_lms_account_actor_b');
    const ra = new StudentRepository(fixture.db, a),
      rb = new StudentRepository(fixture.db, b);
    const lms = new LmsRepository(fixture.db, a);
    await assert.rejects(lms.authorize(), { code: 'FORBIDDEN' });
    await fixture.db.user.update({
      where: { id: a.id },
      data: { lmsAccessOverride: 'ENABLED' },
    });
    await lms.authorize();
    const profile = {
      educationLevel: 'Graduate',
      institution: 'Shared profile fixture',
      graduationYear: 2027,
      interests: ['Learning'],
      careerGoals: 'Develop skills',
    };
    await ra.updateProfile(profile);
    assert.deepEqual(await ra.profile(), profile);
    assert.equal(await rb.profile(), null);
    await assert.rejects(ra.updateProfile({ ...profile, userId: b.id }), {
      code: 'INVALID_INPUT',
    });
    await assert.rejects(
      ra.updateProfile({ ...profile, lmsAccessOverride: 'ENABLED' }),
      { code: 'INVALID_INPUT' },
    );
    const { id } = await ra.createTicket({
      category: 'Technical',
      subject: 'Native LMS fixture',
      message: 'Please help with learning access.',
    });
    assert.equal((await ra.tickets()).length, 1);
    assert.equal((await rb.tickets()).length, 0);
    await assert.rejects(rb.ticket(id), { code: 'NOT_FOUND' });
    await assert.rejects(rb.reply(id, { message: 'Unauthorized reply' }), {
      code: 'NOT_FOUND',
    });
    await ra.reply(id, { message: 'Student follow-up' });
    assert.equal((await ra.ticket(id)).messages.length, 2);
    await assert.rejects(
      ra.reply(id, { message: 'Staff spoof', actor: 'STAFF' }),
      { code: 'INVALID_INPUT' },
    );
    await fixture.db.supportTicket.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    await assert.rejects(ra.reply(id, { message: 'Closed reply' }), {
      code: 'CONFLICT',
    });
    assert.equal((await ra.ticket(id)).messages.length, 2);
    await fixture.db.user.update({
      where: { id: a.id },
      data: { lmsAccessOverride: 'DISABLED' },
    });
    await assert.rejects(lms.authorize(), { code: 'FORBIDDEN' });
    // Dashboard support domain remains available under its existing policy; the LMS adapter adds its own entitlement gate.
    assert.equal((await ra.ticket(id)).subject, 'Native LMS fixture');
    assert.throws(
      () => new StudentRepository(fixture.db, { ...a, role: 'ADMIN' }),
      { code: 'FORBIDDEN' },
    );
  } finally {
    await fixture.cleanup();
  }
});
