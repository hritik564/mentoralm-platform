import type {
  PrismaClient,
  QuestionType,
} from '../../src/generated/prisma/client';
export async function academicFixture(
  db: PrismaClient,
  userId: string,
  suffix: string,
) {
  const course = await db.course.create({
    data: {
      title: `Academic Skills ${suffix}`,
      description: 'A structured academic journey.',
      published: true,
      academicCompletionEnabled: true,
      certificateEnabled: true,
      thumbnailPath: '/images/campus.webp',
      thumbnailAlt: 'Campus',
      publicPath: '/#programs',
    },
  });
  await db.enrollment.create({ data: { courseId: course.id, userId } });
  const section = await db.section.create({
    data: {
      courseId: course.id,
      title: 'Academic foundations',
      position: 1,
      published: true,
    },
  });
  const bank = await db.questionBank.create({
    data: { title: `Foundations ${suffix}` },
  });
  async function question(
    type: QuestionType,
    prompt: string,
    position: number,
    choices: string[] = [],
    correct: number[] = [],
  ) {
    return db.question.create({
      data: {
        bankId: bank.id,
        type,
        prompt,
        position,
        published: true,
        explanation: 'Explanation available after submission.',
        options: {
          create: choices.map((label, i) => ({
            label,
            position: i + 1,
            correct: correct.includes(i),
          })),
        },
      },
      include: { options: { orderBy: { position: 'asc' } } },
    });
  }
  const single = await question(
    'SINGLE_CHOICE',
    'Choose the clear statement.',
    1,
    ['Clear', 'Vague'],
    [0],
  );
  const multi = await question(
    'MULTIPLE_CHOICE',
    'Select both helpful practices.',
    2,
    ['Listen', 'Clarify', 'Interrupt'],
    [0, 1],
  );
  const boolean = await question(
    'TRUE_FALSE',
    'Listening supports understanding.',
    3,
    ['True', 'False'],
    [0],
  );
  const short = await question('SHORT_TEXT', 'Describe your approach.', 4);
  const long = await question('LONG_TEXT', 'Explain your reasoning.', 5);
  async function item(
    title: string,
    type: 'LESSON' | 'QUIZ' | 'ASSESSMENT' | 'ASSIGNMENT',
    position: number,
    required = true,
  ) {
    return db.learningItem.create({
      data: {
        sectionId: section.id,
        title,
        type,
        position,
        published: true,
        required,
      },
    });
  }
  const lesson = await item('Learning foundation', 'LESSON', 1);
  await db.lesson.create({
    data: {
      itemId: lesson.id,
      format: 'TEXT',
      structuredContent: {
        version: 1,
        blocks: [{ type: 'paragraph', text: 'Learn, practice and reflect.' }],
      },
    },
  });
  const quiz = await item('Foundations quiz', 'QUIZ', 2);
  await db.academicActivity.create({
    data: {
      itemId: quiz.id,
      itemType: 'QUIZ',
      published: true,
      instructions:
        'Choose the best answers. <script>window.__questionXss=true</script>',
      passingPercent: 100,
      attemptLimit: 3,
      reviewAnswers: true,
      questions: {
        create: [single, multi, boolean].map((q, i) => ({
          questionId: q.id,
          position: i + 1,
          points: i + 1,
        })),
      },
    },
  });
  const assessment = await item('Reflection assessment', 'ASSESSMENT', 3);
  await db.academicActivity.create({
    data: {
      itemId: assessment.id,
      itemType: 'ASSESSMENT',
      published: true,
      instructions: 'Reflect in your own words.',
      questions: {
        create: [single, short, long].map((q, i) => ({
          questionId: q.id,
          position: i + 1,
          points: 1,
        })),
      },
    },
  });
  const assignment = await item('Practice assignment', 'ASSIGNMENT', 4);
  await db.assignment.create({
    data: {
      itemId: assignment.id,
      published: true,
      instructions: 'Submit your practice notes.',
      allowedKinds: ['TEXT', 'FILE', 'TEXT_AND_FILE'],
      requiresAcceptance: true,
      maxFiles: 2,
      maxFileBytes: 1024 * 1024,
    },
  });
  const optional = await item('Optional reflection', 'ASSESSMENT', 5, false);
  await db.academicActivity.create({
    data: {
      itemId: optional.id,
      itemType: 'ASSESSMENT',
      published: true,
      instructions: 'Optional reflection.',
      questions: { create: { questionId: short.id, position: 1, points: 1 } },
    },
  });
  const batch = await db.batch.create({
    data: {
      code: `L3-${suffix.toUpperCase()}`,
      name: `Academic cohort ${suffix}`,
      courseId: course.id,
      status: 'ACTIVE',
      lmsAccessEnabled: true,
      startsAt: new Date('2020-01-01'),
    },
  });
  const membership = await db.batchMembership.create({
    data: { batchId: batch.id, userId, joinedAt: new Date('2020-01-01') },
  });
  const session = await db.batchSession.create({
    select: {
      id: true,
      batchId: true,
      courseId: true,
      itemId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      status: true,
      externalTargetId: true,
      locationLabel: true,
    },
    data: {
      batchId: batch.id,
      courseId: course.id,
      title: 'Practice session',
      startsAt: new Date('2026-09-01T09:00:00Z'),
      endsAt: new Date('2026-09-01T10:00:00Z'),
      status: 'HELD',
    },
  });
  return {
    course,
    section,
    bank,
    single,
    multi,
    boolean,
    short,
    long,
    lesson,
    quiz,
    assessment,
    assignment,
    optional,
    batch,
    membership,
    session,
  };
}
