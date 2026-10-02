import { loadEnvConfig } from '@next/env';
import { createClerkClient } from '@clerk/backend';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { mkdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../src/generated/prisma/client';
import { provisionUser } from '../../src/lib/student/repository';
import { LearningRepository } from '../../src/lib/lms/learning';
import { Attempts } from '../../src/lib/lms/attempts';
import { Assignments } from '../../src/lib/lms/assignments';
import { Academics } from '../../src/lib/lms/academics';
import { localSeedUrl, verifyDatabase } from './safety';
import { seedFixtures, resetFixtures, seedIds } from './fixtures';

function originalWorkbook() {
  const lines = [
    'MentoraLM - Local career growth workbook',
    'Original development practice material. No production records.',
    '',
    '1. Define a career goal and a measurable next step.',
    '2. Draft a prompt with task, audience, context and constraints.',
    '3. Check factual claims against original sources.',
    '4. Remove private information before using external AI tools.',
    '5. Reflect on what improved and what you will try next.',
  ];
  const stream = `BT /F1 14 Tf 50 760 Td 22 TL ${lines.map((line, index) => `${index ? 'T* ' : ''}(${line}) Tj`).join('\n')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}
async function privateRoots() {
  const envPath = resolve('.env.local');
  let envText = await readFile(envPath, 'utf8');
  for (const [name, folder] of [
    ['LMS_FILES_ROOT', 'media'],
    ['LMS_SUBMISSIONS_ROOT', 'submissions'],
  ]) {
    const root = resolve(process.env[name] || `.local/lms-owner/${folder}`);
    // Files are never placed under a publicly served directory, including symlink aliases.
    await mkdir(root, { recursive: true, mode: 0o700 });
    const canonical = await realpath(root),
      publicRoot = await realpath(resolve('public'));
    const path = relative(publicRoot, canonical);
    if (!isAbsolute(path) && !path.startsWith('..'))
      throw Error('Private file root must be outside public.');
    if (!process.env[name]) {
      envText += `\n${name}=${JSON.stringify(canonical)}\n`;
      process.env[name] = canonical;
    }
  }
  await writeFile(envPath, envText, { mode: 0o600 });
}
async function complete(
  db: PrismaClient,
  actor: { id: string; role: 'STUDENT' },
  id: (name: string) => string,
) {
  const learning = new LearningRepository(db, actor);
  for (const name of ['welcome', 'pdf', 'prompt', 'verify', 'workflow'])
    await learning.record(id('course'), id(name), true);
  const attempts = new Attempts(db, actor.id);
  for (const name of ['quiz', 'assessment']) {
    if (
      await db.academicAttempt.findFirst({
        where: {
          userId: actor.id,
          activityId: id(name),
          status: 'SUBMITTED',
          ...(name === 'quiz'
            ? { percentage: { gte: 70 }, requiresReview: false }
            : {}),
        },
      })
    )
      continue;
    const attempt = await attempts.start(id('course'), id(name));
    const activity = await db.academicActivity.findUniqueOrThrow({
      where: { itemId: id(name) },
      include: {
        questions: { include: { question: { include: { options: true } } } },
      },
    });
    await attempts.save(id('course'), id(name), attempt.id, {
      answers: activity.questions.map(({ question: q }) =>
        q.options.length
          ? {
              questionId: q.id,
              optionIds: q.options.filter((o) => o.correct).map((o) => o.id),
            }
          : {
              questionId: q.id,
              text: 'I will draft a career action plan with clear context, verify claims using original sources, protect private information, and reflect on the results.',
            },
      ),
    });
    await attempts.submit(id('course'), id(name), attempt.id);
  }
  if (
    !(await db.assignmentSubmission.findFirst({
      where: {
        userId: actor.id,
        assignmentId: id('assignment'),
        versions: { some: {} },
      },
    }))
  )
    await new Assignments(db, actor.id).submit(id('course'), id('assignment'), {
      requestKey: randomUUID(),
      kind: 'TEXT',
      text: 'My career goal is to improve my portfolio. I will research a role, draft an example project with a contextual prompt, verify claims, and write a reflection. This is original local practice work.',
    });
  const enrollment = await db.enrollment.findUniqueOrThrow({
    where: { userId_courseId: { userId: actor.id, courseId: id('course') } },
  });
  if (
    enrollment.status !== 'COMPLETED' ||
    !(await db.certificate.findFirst({
      where: { userId: actor.id, courseId: id('course'), status: 'ACTIVE' },
    }))
  )
    throw Error(
      'Real completion rules did not yield a completed course/certificate.',
    );
}
let stage = 'configuration';
async function main() {
  // Check caller NODE_ENV before Next's environment loader defaults it.
  const callerEnvironment = process.env.NODE_ENV;
  loadEnvConfig(process.cwd(), true);
  const url = localSeedUrl({
    ...process.env,
    NODE_ENV: callerEnvironment ?? process.env.NODE_ENV,
  });
  const args = process.argv.slice(2);
  let owner = process.env.LMS_SEED_OWNER;
  let reset = false,
    completed = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--owner') owner = args[++index];
    else if (args[index] === '--reset') reset = true;
    else if (args[index] === '--completed') completed = true;
    else
      throw Error(
        'Usage: dev:lms-seed -- --owner <existing Clerk user ID or email> [--completed | --reset]',
      );
  }
  if (!owner || (reset && completed))
    throw Error(
      'An explicit owner is required; --reset and --completed are exclusive.',
    );
  stage = 'Clerk Development identity lookup';
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  let clerkId: string;
  if (/^user_[a-zA-Z0-9]+$/.test(owner))
    clerkId = (await clerk.users.getUser(owner)).id;
  else {
    const users = await clerk.users.getUserList({
      emailAddress: [owner],
      limit: 2,
    });
    const matches = users.data.filter((user) =>
      user.emailAddresses.some(
        (email) => email.emailAddress.toLowerCase() === owner!.toLowerCase(),
      ),
    );
    if (users.totalCount !== 1 || matches.length !== 1)
      throw Error(
        'Owner email must resolve to exactly one existing Clerk Development user.',
      );
    clerkId = matches[0].id;
  }
  stage = 'local database verification';
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }, { schema: 'public' }),
  });
  const lock = new Client({ connectionString: url });
  try {
    await lock.connect();
    // Serialize this utility across owners: protects env file edits and reset versus seed.
    await lock.query(
      "SELECT pg_advisory_lock(hashtext('mentoralm-local-owner-seed'))",
    );
    await verifyDatabase(db);
    let actor = await db.user.findUnique({
      where: { clerkUserId: clerkId },
      select: { id: true, role: true },
    });
    if (reset) {
      stage = 'bounded seed reset';
      if (actor) await resetFixtures(db, actor.id, clerkId);
      console.log(
        'Reset complete: seed course context removed; owner identity, Student ID and unrelated records retained. Private files/config retained for safe reuse.',
      );
      return;
    }
    actor ??= await provisionUser(db, clerkId);
    if (actor.role !== 'STUDENT')
      throw Error(
        'Owner account must be a Student; the utility will not change roles.',
      );
    stage = 'private local storage';
    await privateRoots();
    const { id } = seedIds(clerkId);
    const pdfKey = `${id('workbook')}.pdf`;
    const pdfPath = resolve(process.env.LMS_FILES_ROOT!, pdfKey);
    // Exclusive write: never overwrite a file that already exists.
    try {
      await writeFile(pdfPath, originalWorkbook(), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'EEXIST'
      ))
        throw error;
    }
    stage = 'fixture transaction';
    await seedFixtures(db, actor.id, clerkId, pdfKey);
    stage = 'domain read/completion verification';
    const student = { id: actor.id, role: 'STUDENT' as const };
    if (completed) await complete(db, student, id);
    else {
      const hasState = await db.lessonState.findUnique({
        where: { userId_itemId: { userId: actor.id, itemId: id('welcome') } },
      });
      if (!hasState)
        await new LearningRepository(db, student).record(
          id('course'),
          id('welcome'),
          true,
        );
    }
    const learning = new LearningRepository(db, student);
    const course = await learning.course(id('course'));
    if (
      !course ||
      !(await learning.dashboardSummaries()).some(
        (summary) => summary.id === id('course'),
      )
    )
      throw Error('Authorized course/Dashboard read verification failed.');
    const assignments = await new Assignments(db, actor.id).list();
    const attendance = await new Academics(db, student).attendance();
    console.log(
      JSON.stringify(
        {
          result:
            'Seed ready; existing Clerk Development identity resolved without modification.',
          courseId: id('course'),
          sections: await db.section.count({
            where: { courseId: id('course') },
          }),
          items: await db.learningItem.count({
            where: { section: { courseId: id('course') } },
          }),
          questions: await db.question.count({ where: { bankId: id('bank') } }),
          attendanceRows: await db.attendanceRecord.count({
            where: { userId: actor.id, session: { batchId: id('batch') } },
          }),
          threads: await db.discussionThread.count({
            where: { courseId: id('course') },
          }),
          assignmentRead: Boolean(assignments),
          attendanceRead: Boolean(attendance),
          completed,
          courseUrl: `http://127.0.0.1:3000/learn/courses/${id('course')}`,
          note: 'Restart local server after first seed to load private storage roots. Video is honest metadata-only; no media asset is claimed. Certificates have no fabricated PDF.',
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
    await lock.end();
  }
}
main().catch((error: unknown) => {
  const code =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    /^[A-Za-z0-9_]{1,40}$/.test(String(error.code))
      ? String(error.code)
      : 'unavailable';
  console.error(`Failed stage: ${stage}; code: ${code}.`);
  console.error(
    'Local LMS seed failed. Check local-only configuration, owner identity, seed ownership and database availability. No credentials or provider errors are printed.',
  );
  process.exitCode = 1;
});
