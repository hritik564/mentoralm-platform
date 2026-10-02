import { createHash } from 'node:crypto';
import type {
  PrismaClient,
  Prisma,
  QuestionType,
  AttendanceStatus,
} from '../../src/generated/prisma/client';

export function seedIds(clerkId: string) {
  const prefix = `local_owner_${createHash('sha256').update(clerkId).digest('hex').slice(0, 16)}`;
  return { prefix, id: (name: string) => `${prefix}_${name}` };
}
export async function seedFixtures(
  db: PrismaClient,
  userId: string,
  clerkId: string,
  pdfKey: string,
) {
  const { prefix, id } = seedIds(clerkId);
  await db.$transaction(
    async (tx) => {
      const marker = await tx.academicAudit.findUnique({
        where: { id: id('marker') },
      });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.role !== 'STUDENT')
        throw Error('Owner account must already have the STUDENT role.');
      if (!marker) {
        for (const occupied of [
          await tx.course.findUnique({ where: { id: id('course') } }),
          await tx.program.findUnique({ where: { id: id('program') } }),
          await tx.batch.findUnique({ where: { id: id('batch') } }),
          await tx.questionBank.findUnique({ where: { id: id('bank') } }),
        ])
          if (occupied)
            throw Error(
              'Seed identifiers are occupied without an ownership marker.',
            );
        await tx.academicAudit.create({
          data: {
            id: id('marker'),
            actorId: userId,
            action: 'LOCAL_OWNER_SEED',
            targetId: prefix,
            details: { version: 1, previousOverride: user.lmsAccessOverride },
          },
        });
      } else if (
        marker.actorId !== userId ||
        marker.action !== 'LOCAL_OWNER_SEED' ||
        marker.targetId !== prefix
      )
        throw Error('Seed ownership mismatch.');
      await tx.user.update({
        where: { id: userId },
        data: { lmsAccessOverride: 'ENABLED' },
      });
      await tx.program.upsert({
        where: { id: id('program') },
        update: {},
        create: { id: id('program'), title: 'CareerIgnite Program' },
      });
      await tx.course.upsert({
        where: { id: id('course') },
        update: {},
        create: {
          id: id('course'),
          programId: id('program'),
          title: 'AI Tools for Career Growth',
          description:
            'Local owner practice course: explore AI responsibly, develop a career workflow, and reflect on your results.',
          published: true,
          academicCompletionEnabled: true,
          certificateEnabled: true,
          thumbnailPath: '/images/campus.webp',
          thumbnailAlt: 'A university campus',
          publicPath: '/#programs',
        },
      });
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId, courseId: id('course') } },
        update: {},
        create: { userId, courseId: id('course') },
      });
      await tx.batch.upsert({
        where: { id: id('batch') },
        update: {},
        create: {
          id: id('batch'),
          courseId: id('course'),
          code: `CI-OCT26-${prefix.slice(-16).toUpperCase()}`,
          name: 'CareerIgnite OCT-26',
          status: 'ACTIVE',
          lmsAccessEnabled: true,
          startsAt: new Date('2020-01-01'),
        },
      });
      await tx.batchMembership.upsert({
        where: { userId_batchId: { userId, batchId: id('batch') } },
        update: {},
        create: {
          id: id('membership'),
          userId,
          batchId: id('batch'),
          joinedAt: new Date('2020-01-01'),
        },
      });
      for (const [index, title] of [
        'Getting Started',
        'AI Foundations',
        'Practical Work',
      ].entries())
        await tx.section.upsert({
          where: { id: id(`section${index + 1}`) },
          update: {},
          create: {
            id: id(`section${index + 1}`),
            courseId: id('course'),
            title,
            position: index + 1,
            published: true,
          },
        });
      async function item(
        name: string,
        section: number,
        position: number,
        title: string,
        type: 'LESSON' | 'QUIZ' | 'ASSESSMENT' | 'ASSIGNMENT' | 'RESOURCE',
        required = true,
      ) {
        await tx.learningItem.upsert({
          where: { id: id(name) },
          update: {},
          create: {
            id: id(name),
            sectionId: id(`section${section}`),
            position,
            title,
            type,
            required,
            published: true,
          },
        });
      }
      const texts = [
        [
          'welcome',
          1,
          1,
          'Welcome to your career growth journey',
          'Start with one career goal. Write down a task you want to improve, the skill it requires, and a small outcome you can measure.',
        ],
        [
          'optional',
          1,
          4,
          'Optional: define your learning rhythm',
          'Choose two weekly practice slots. Keep a reflection log of what you tried, what worked, and what you will change.',
        ],
        [
          'prompt',
          2,
          1,
          'Build a clear prompt',
          'Describe the task, audience, constraints, and desired format. Include a useful example. Iterate by checking the output against your goal.',
        ],
        [
          'verify',
          2,
          2,
          'Verify before you rely on AI',
          'AI output can contain errors. Verify important claims with original sources. Remove private information before sending a prompt to an external tool.',
        ],
        [
          'workflow',
          2,
          3,
          'Turn a goal into a workflow',
          'Break a job search into research, drafting, review, and follow-up. Use AI to support each step while keeping the final decision and fact-checking with you.',
        ],
      ] as const;
      for (const [name, section, position, title, text] of texts) {
        await item(
          name,
          section,
          position,
          title,
          'LESSON',
          name !== 'optional',
        );
        await tx.lesson.upsert({
          where: { itemId: id(name) },
          update: {},
          create: {
            itemId: id(name),
            format: 'TEXT',
            structuredContent: {
              version: 1,
              blocks: [
                { type: 'heading', text: title, level: 2 },
                { type: 'paragraph', text },
              ],
            },
          },
        });
      }
      await item(
        'video',
        1,
        2,
        'A practical AI workflow — video preview',
        'LESSON',
        false,
      );
      await tx.lesson.upsert({
        where: { itemId: id('video') },
        update: {},
        create: {
          itemId: id('video'),
          format: 'VIDEO',
          mimeType: 'video/webm',
          fileName: 'career-workflow.webm',
          durationSeconds: 180,
        },
      });
      await item('pdf', 1, 3, 'Your career growth workbook', 'LESSON');
      await tx.lesson.upsert({
        where: { itemId: id('pdf') },
        update: {},
        create: {
          itemId: id('pdf'),
          format: 'PDF',
          storageKey: pdfKey,
          mimeType: 'application/pdf',
          fileName: 'career-growth-workbook.pdf',
          downloadAllowed: true,
        },
      });
      await item(
        'resource',
        3,
        2,
        'Prompt planning worksheet',
        'RESOURCE',
        false,
      );
      await tx.learningResource.upsert({
        where: { itemId: id('resource') },
        update: {},
        create: {
          itemId: id('resource'),
          description:
            'An original local worksheet for planning, verifying, and reflecting on AI-assisted career work.',
          storageKey: pdfKey,
          mimeType: 'application/pdf',
          fileName: 'prompt-planning-worksheet.pdf',
        },
      });
      await tx.questionBank.upsert({
        where: { id: id('bank') },
        update: {},
        create: { id: id('bank'), title: 'Local career AI practice questions' },
      });
      const questions: {
        type: QuestionType;
        prompt: string;
        options?: string[];
        correct?: number[];
      }[] = [
        {
          type: 'SINGLE_CHOICE',
          prompt: 'What makes a useful career prompt?',
          options: [
            'A clear goal, context, and constraints',
            'No context',
            'Only a vague instruction',
          ],
          correct: [0],
        },
        {
          type: 'MULTIPLE_CHOICE',
          prompt: 'Select the responsible AI practices.',
          options: [
            'Verify important claims',
            'Protect personal information',
            'Trust every generated claim',
          ],
          correct: [0, 1],
        },
        {
          type: 'TRUE_FALSE',
          prompt: 'You remain responsible for checking AI-assisted work.',
          options: ['True', 'False'],
          correct: [0],
        },
        {
          type: 'SHORT_TEXT',
          prompt:
            'Describe one task where AI could help your career preparation.',
        },
        {
          type: 'LONG_TEXT',
          prompt:
            'Explain a career workflow, how you would use AI, and how you would verify the output.',
        },
      ];
      for (const [index, q] of questions.entries()) {
        await tx.question.upsert({
          where: { id: id(`q${index}`) },
          update: {},
          create: {
            id: id(`q${index}`),
            bankId: id('bank'),
            type: q.type,
            prompt: q.prompt,
            position: index + 1,
            published: true,
            explanation:
              'Clear context, verification, and privacy help make AI-assisted career work useful.',
          },
        });
        for (const [option, label] of (q.options || []).entries())
          await tx.questionOption.upsert({
            where: { id: id(`q${index}o${option}`) },
            update: {},
            create: {
              id: id(`q${index}o${option}`),
              questionId: id(`q${index}`),
              label,
              position: option + 1,
              correct: q.correct?.includes(option) || false,
            },
          });
      }
      for (const [name, type, position, title, indexes] of [
        ['quiz', 'QUIZ', 4, 'Responsible AI knowledge check', [0, 1, 2]],
        [
          'assessment',
          'ASSESSMENT',
          5,
          'Career workflow reflection',
          [0, 3, 4],
        ],
      ] as const) {
        await item(name, 2, position, title, type);
        await tx.academicActivity.upsert({
          where: { itemId: id(name) },
          update: {},
          create: {
            itemId: id(name),
            itemType: type,
            published: true,
            instructions:
              type === 'QUIZ'
                ? 'Choose the best answers. A score of 70% passes this knowledge check.'
                : 'Reflect in your own words. This practice activity is complete on submission; written responses remain pending review, not automatically graded.',
            passingPercent: type === 'QUIZ' ? 70 : null,
            attemptLimit: 5,
            reviewAnswers: false,
          },
        });
        for (const [index, q] of indexes.entries())
          await tx.activityQuestion.upsert({
            where: {
              activityId_questionId: {
                activityId: id(name),
                questionId: id(`q${q}`),
              },
            },
            update: {},
            create: {
              activityId: id(name),
              questionId: id(`q${q}`),
              position: index + 1,
              points: 1,
            },
          });
      }
      await item(
        'assignment',
        3,
        1,
        'Build your AI-assisted career action plan',
        'ASSIGNMENT',
      );
      await tx.assignment.upsert({
        where: { itemId: id('assignment') },
        update: {},
        create: {
          itemId: id('assignment'),
          published: true,
          instructions:
            'Describe your career goal, draft a reusable prompt, outline three actions, and explain how you will verify results. Submit text, a PDF or text file, or both. This local practice assignment completes on submission; no acceptance or grade is implied. You may resubmit improved work.',
          allowedKinds: ['TEXT', 'FILE', 'TEXT_AND_FILE'],
          maxFiles: 3,
          maxFileBytes: 5 * 1024 ** 2,
          requiresAcceptance: false,
          allowResubmission: true,
        },
      });
      const statuses: AttendanceStatus[] = [
        'PRESENT',
        'PRESENT',
        'LATE',
        'ABSENT',
        'EXCUSED',
      ];
      for (const [index, status] of statuses.entries()) {
        const startsAt = new Date(Date.now() - (10 - index) * 86400000);
        startsAt.setUTCHours(9, 0, 0, 0);
        await tx.batchSession.upsert({
          where: { id: id(`session${index}`) },
          update: {},
          create: {
            id: id(`session${index}`),
            batchId: id('batch'),
            courseId: id('course'),
            title: [
              'Career goals workshop',
              'Prompt practice lab',
              'Fact-checking clinic',
              'Portfolio planning',
              'Career reflection',
            ][index],
            startsAt,
            endsAt: new Date(startsAt.getTime() + 3600000),
            status: 'HELD',
          },
        });
        await tx.attendanceRecord.upsert({
          where: {
            sessionId_userId: { sessionId: id(`session${index}`), userId },
          },
          update: {},
          create: {
            sessionId: id(`session${index}`),
            membershipId: id('membership'),
            userId,
            status,
          },
        });
      }
      for (const [index, title] of [
        'Welcome and introductions',
        'Share a prompt you improved',
        'Weekly career action reflection',
      ].entries()) {
        await tx.discussionThread.upsert({
          where: { id: id(`thread${index}`) },
          update: {},
          create: {
            id: id(`thread${index}`),
            courseId: id('course'),
            batchId: index === 0 ? id('batch') : null,
            authorId: userId,
            title,
          },
        });
        await tx.discussionPost.upsert({
          where: { id: id(`post${index}`) },
          update: {},
          create: {
            id: id(`post${index}`),
            threadId: id(`thread${index}`),
            authorId: userId,
            body: [
              'Local practice thread: introduce your career goal and one skill you want to build.',
              'What context helped you improve an AI prompt? Add your example as a reply.',
              'Use this thread to reflect on a small action you tried this week.',
            ][index],
          },
        });
      }
    },
    { isolationLevel: 'Serializable', timeout: 30000 },
  );
  return { prefix, id };
}

export async function resetFixtures(
  db: PrismaClient,
  userId: string,
  clerkId: string,
) {
  const { prefix, id } = seedIds(clerkId);
  await db.$transaction(
    async (tx) => {
      const marker = await tx.academicAudit.findUnique({
        where: { id: id('marker') },
      });
      if (!marker) return;
      if (
        marker.actorId !== userId ||
        marker.action !== 'LOCAL_OWNER_SEED' ||
        marker.targetId !== prefix
      )
        throw Error('Reset ownership mismatch.');
      const details = marker.details as {
        version?: number;
        previousOverride?: string | null;
      };
      if (
        details.version !== 1 ||
        ![null, 'ENABLED', 'DISABLED'].includes(
          details.previousOverride ?? null,
        )
      )
        throw Error('Invalid reset marker.');
      // Foreign data or authoring attached to this fixture makes reset unsafe: stop rather than broaden deletion.
      const foreign = [
        await tx.courseView.count({
          where: { courseId: id('course'), userId: { not: userId } },
        }),
        await tx.assignmentReview.count({
          where: {
            version: {
              submission: {
                assignment: { item: { section: { courseId: id('course') } } },
              },
            },
          },
        }),
        await tx.enrollment.count({
          where: { courseId: id('course'), userId: { not: userId } },
        }),
        await tx.batchMembership.count({
          where: { batchId: id('batch'), userId: { not: userId } },
        }),
        await tx.discussionPost.count({
          where: {
            thread: { courseId: id('course') },
            authorId: { not: userId },
          },
        }),
        await tx.discussionThread.count({
          where: { courseId: id('course'), authorId: { not: userId } },
        }),
        await tx.course.count({
          where: { programId: id('program'), id: { not: id('course') } },
        }),
        await tx.batch.count({
          where: {
            OR: [{ courseId: id('course') }, { programId: id('program') }],
            id: { not: id('batch') },
          },
        }),
        await tx.section.count({
          where: {
            courseId: id('course'),
            id: { not: { startsWith: `${prefix}_` } },
          },
        }),
        await tx.learningItem.count({
          where: {
            section: { courseId: id('course') },
            id: { not: { startsWith: `${prefix}_` } },
          },
        }),
        await tx.academicAttempt.count({
          where: {
            activity: { item: { section: { courseId: id('course') } } },
            userId: { not: userId },
          },
        }),
        await tx.assignmentSubmission.count({
          where: {
            assignment: { item: { section: { courseId: id('course') } } },
            userId: { not: userId },
          },
        }),
        await tx.lessonState.count({
          where: {
            lesson: { item: { section: { courseId: id('course') } } },
            userId: { not: userId },
          },
        }),
        await tx.certificate.count({
          where: { courseId: id('course'), userId: { not: userId } },
        }),
        await tx.attendanceRecord.count({
          where: { session: { batchId: id('batch') }, userId: { not: userId } },
        }),
        await tx.question.count({
          where: {
            bankId: id('bank'),
            id: { not: { startsWith: `${prefix}_` } },
          },
        }),
        await tx.batchSession.count({
          where: {
            batchId: id('batch'),
            id: { not: { startsWith: `${prefix}_` } },
          },
        }),
        await tx.communicationMessage.count({
          where: { batchId: id('batch') },
        }),
        await tx.batchInstructor.count({ where: { batchId: id('batch') } }),
        await tx.activityQuestion.count({
          where: {
            question: { bankId: id('bank') },
            activity: {
              item: { section: { courseId: { not: id('course') } } },
            },
          },
        }),
      ];
      if (foreign.some(Boolean))
        throw Error(
          'Reset refused: non-owned records are attached to this seed.',
        );
      const items = { section: { courseId: id('course') } };
      await tx.assignmentReview.deleteMany({
        where: { version: { submission: { assignment: { item: items } } } },
      });
      await tx.assignmentSubmission.deleteMany({
        where: { assignment: { item: items } },
      });
      await tx.academicAttempt.deleteMany({
        where: { activity: { item: items } },
      });
      await tx.attendanceRecord.deleteMany({
        where: { session: { batchId: id('batch') } },
      });
      await tx.batchSession.deleteMany({ where: { batchId: id('batch') } });
      await tx.discussionPost.deleteMany({
        where: { thread: { courseId: id('course') } },
      });
      await tx.discussionThread.deleteMany({
        where: { courseId: id('course') },
      });
      await tx.certificate.deleteMany({ where: { courseId: id('course') } });
      await tx.learningEvent.deleteMany({
        where: { courseId: id('course'), userId },
      });
      await tx.courseView.deleteMany({
        where: { courseId: id('course'), userId },
      });
      await tx.enrollment.deleteMany({
        where: { courseId: id('course'), userId },
      });
      await tx.batchMembership.deleteMany({
        where: { batchId: id('batch'), userId },
      });
      await tx.batch.deleteMany({ where: { id: id('batch') } });
      await tx.course.deleteMany({ where: { id: id('course') } });
      await tx.question.deleteMany({ where: { bankId: id('bank') } });
      await tx.questionBank.deleteMany({ where: { id: id('bank') } });
      await tx.program.deleteMany({ where: { id: id('program') } });
      const current = await tx.user.findUniqueOrThrow({
        where: { id: userId },
      });
      if (current.lmsAccessOverride === 'ENABLED')
        await tx.user.update({
          where: { id: userId },
          data: {
            lmsAccessOverride: (details.previousOverride ??
              null) as Prisma.UserUpdateInput['lmsAccessOverride'],
          },
        });
      await tx.academicAudit.delete({ where: { id: marker.id } });
    },
    { isolationLevel: 'Serializable', timeout: 30000 },
  );
}
