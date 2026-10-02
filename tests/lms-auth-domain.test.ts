import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lmsReturn,
  lmsAuthPath,
  lmsAuthReturn,
} from '../src/lib/auth/lms-entry';
import { domainRoute } from '../src/lib/platform/domains';
import { isolatedDatabase } from './helpers/d4-database';
import {
  provisionUser,
  StudentRepository,
} from '../src/lib/student/repository';
import { LmsRepository } from '../src/lib/lms/repository';
test('LMS auth return paths reject external, ambiguous and non-learning destinations', () => {
  for (const value of [
    'https://evil.example/',
    'https://students.mentoralm.com/courses/a',
    '//evil.example',
    '/\\evil.example',
    '/learn/../dashboard',
    '/learn/%2e%2e/dashboard',
    '/learn?next=https://evil.example',
    '/dashboard',
    [' /learn'],
    '/sign-in',
  ]) {
    assert.deepEqual(lmsReturn(value), { internal: '/learn', rejected: true });
  }
  assert.deepEqual(lmsReturn(undefined), {
    internal: '/learn',
    rejected: false,
  });
  for (const value of [
    '/courses/a/lessons/b',
    '/learn/courses/a/lessons/b',
    '/support',
    '/profile',
  ])
    assert.equal(
      lmsReturn(value).internal,
      value.startsWith('/learn') ? value : `/learn${value}`,
    );
  assert.equal(lmsAuthPath('sign-in', 'students.mentoralm.com'), '/sign-in');
  assert.equal(lmsAuthPath('sign-in', '127.0.0.1:3000'), '/lms-auth/sign-in');
  assert.throws(() => lmsAuthPath('sign-in', 'evil.example'));
  assert.equal(
    lmsAuthReturn('sign-in', 'https://evil.example', 'students.mentoralm.com'),
    '/sign-in?redirect_url=%2Flearn',
  );
  const origins = {
    website: 'https://mentoralm.com',
    lms: 'https://students.mentoralm.com',
  };
  for (const path of [
    '/sign-in',
    '/sign-up',
    '/sign-in/factor-one',
    '/sign-in/reset-password',
  ])
    assert.deepEqual(domainRoute('students.mentoralm.com', path, origins), {
      kind: 'rewrite',
      path: `/lms-auth${path}`,
    });
  assert.deepEqual(domainRoute('mentoralm.com', '/sign-in', origins), {
    kind: 'next',
    path: '/sign-in',
  });
});
test('signup provisions the same User without learning entitlement or enrollment; support does not grant access', async () => {
  const fixture = await isolatedDatabase();
  try {
    const actor = await provisionUser(fixture.db, 'local_auth_signup_fixture');
    assert.equal(
      (await provisionUser(fixture.db, 'local_auth_signup_fixture')).id,
      actor.id,
    );
    const stored = await fixture.db.user.findUniqueOrThrow({
      where: { id: actor.id },
    });
    assert.equal(stored.lmsAccessOverride, null);
    assert.equal(
      await fixture.db.batchMembership.count({ where: { userId: actor.id } }),
      0,
    );
    assert.equal(
      await fixture.db.enrollment.count({ where: { userId: actor.id } }),
      0,
    );
    const repo = new LmsRepository(fixture.db, actor);
    await assert.rejects(repo.authorize(), { code: 'FORBIDDEN' });
    const student = new StudentRepository(fixture.db, actor);
    await student.createTicket({
      category: 'Technical',
      subject: 'Learning access',
      message: 'Please help with access.',
    });
    await assert.rejects(repo.authorize(), { code: 'FORBIDDEN' });
    await assert.rejects(
      student.updateProfile({ lmsAccessOverride: 'ENABLED' }),
      { code: 'INVALID_INPUT' },
    );
    await fixture.db.user.update({
      where: { id: actor.id },
      data: { lmsAccessOverride: 'ENABLED' },
    });
    await repo.authorize();
    await assert.rejects(repo.courseStructure('other_students_course'), {
      code: 'NOT_FOUND',
    });
  } finally {
    await fixture.cleanup();
  }
});
