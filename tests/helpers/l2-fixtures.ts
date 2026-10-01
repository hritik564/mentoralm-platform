import type { PrismaClient } from '../../src/generated/prisma/client';
export const fixtureText = {
  version: 1,
  blocks: [
    { type: 'heading', level: 2, text: 'Speak with intention' },
    { type: 'paragraph', text: 'A clear message starts with a clear purpose.' },
    { type: 'list', items: ['Choose one idea', 'Make it concrete'] },
    { type: 'callout', text: 'Pause. Consider your audience.' },
    { type: 'code', text: '<script>window.__lessonXss = true</script>' },
  ],
};
export async function learningFixture(
  db: PrismaClient,
  userId: string,
  suffix: string,
) {
  const program = await db.program.create({
    data: { title: `CareerIgnite ${suffix}` },
  });
  const course = await db.course.create({
    data: {
      title: `Communication Skills ${suffix}`,
      description: 'A focused self-paced learning journey.',
      programId: program.id,
      published: true,
      publicPath: '/#programs',
      thumbnailPath: '/images/campus.webp',
      thumbnailAlt: 'Campus',
    },
  });
  await db.enrollment.create({ data: { userId, courseId: course.id } });
  const section = await db.section.create({
    data: {
      courseId: course.id,
      title: 'Communication foundations',
      position: 1,
      published: true,
    },
  });
  const second = await db.section.create({
    data: {
      courseId: course.id,
      title: 'Practice and perspective',
      position: 2,
      published: true,
    },
  });
  async function lesson(
    title: string,
    position: number,
    format: 'TEXT' | 'VIDEO' | 'PDF' | 'IMAGE' | 'EXTERNAL',
    required = true,
    secondSection = false,
  ) {
    const item = await db.learningItem.create({
      data: {
        sectionId: secondSection ? second.id : section.id,
        title,
        type: 'LESSON',
        position,
        required,
        published: true,
      },
    });
    await db.lesson.create({
      data: {
        itemId: item.id,
        format,
        ...(format === 'TEXT'
          ? { structuredContent: fixtureText }
          : format === 'EXTERNAL'
            ? { externalTargetId: 'fixture' }
            : {
                storageKey:
                  format === 'VIDEO'
                    ? 'lesson.webm'
                    : format === 'PDF'
                      ? 'lesson.pdf'
                      : 'lesson.png',
                mimeType:
                  format === 'VIDEO'
                    ? 'video/webm'
                    : format === 'PDF'
                      ? 'application/pdf'
                      : 'image/png',
                fileName: `lesson.${format === 'VIDEO' ? 'webm' : format === 'PDF' ? 'pdf' : 'png'}`,
                altText:
                  format === 'IMAGE' ? 'MentoraLM learning illustration' : null,
                captionsStorageKey: format === 'VIDEO' ? 'captions.vtt' : null,
                downloadAllowed: format === 'IMAGE',
              }),
      },
    });
    return item;
  }
  const first = await lesson('Speaking with clarity', 1, 'TEXT'),
    next = await lesson('Listening with purpose', 2, 'TEXT');
  const video = await lesson('Practice video', 1, 'VIDEO', true, true),
    pdf = await lesson('Reference reading', 2, 'PDF', true, true),
    image = await lesson('Visual reference', 3, 'IMAGE', false, true),
    external = await lesson('Explore further', 4, 'EXTERNAL', false, true);
  const resource = await db.learningItem.create({
    data: {
      sectionId: section.id,
      title: 'Practice worksheet',
      type: 'RESOURCE',
      position: 3,
      published: true,
    },
  });
  await db.learningResource.create({
    data: {
      itemId: resource.id,
      mimeType: 'application/pdf',
      fileName: 'worksheet.pdf',
      storageKey: 'lesson.pdf',
      description: 'A worksheet for your learning practice.',
    },
  });
  const quiz = await db.learningItem.create({
    data: {
      sectionId: section.id,
      title: 'Upcoming knowledge check',
      type: 'QUIZ',
      position: 4,
      published: true,
    },
  });
  const draft = await db.learningItem.create({
    data: {
      sectionId: section.id,
      title: 'PRIVATE DRAFT',
      type: 'LESSON',
      position: 5,
      published: false,
    },
  });
  await db.lesson.create({
    data: { itemId: draft.id, format: 'TEXT', structuredContent: fixtureText },
  });
  return {
    course,
    section,
    second,
    first,
    next,
    video,
    pdf,
    image,
    external,
    resource,
    quiz,
    draft,
  };
}
