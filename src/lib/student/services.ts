import 'server-only';
import { Academics } from '../lms/academics';
import { LearningRepository } from '../lms/learning';
import { getDatabase } from '../db/client';
import { getCurrentStudent } from './session';
import { studentRepository } from './session';
import { referralOrigin } from '../db/config';
import {
  publicCourseDestination,
  type DashboardCourses,
} from '../dashboard/courses';
import type { Resource, ResourceRegistry } from '../dashboard/resources';
import {
  supportCategories,
  type SupportTicket,
  type SupportCategory,
  type SupportTicketStatus,
} from '../dashboard/support';
import type { ReferralSummary, ReferralRegistry } from '../dashboard/referral';
import type { StudentRepository } from './repository';

export async function getStudentCourses(): Promise<DashboardCourses> {
  const { views, enrollments } = await (await studentRepository()).courses();
  const learning = await new LearningRepository(
    getDatabase(),
    await getCurrentStudent(),
  ).dashboardSummaries();
  const learningById = new Map(learning.map((course) => [course.id, course]));
  const certificates = await new Academics(
    getDatabase(),
    await getCurrentStudent(),
  ).certificates();
  function course(record: (typeof views)[number]['course']) {
    return {
      id: record.id,
      title: record.title,
      program: record.program?.title || 'Course',
      thumbnail: {
        src: /^\/images\/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$/.test(
          record.thumbnailPath,
        )
          ? record.thumbnailPath
          : '/brand/mentoralm-logo.jpeg',
        alt: record.thumbnailAlt,
      },
      publicDestination:
        publicCourseDestination(record.publicPath) || '/#programs',
    };
  }
  return {
    viewed: views.map((view) => ({
      ...course(view.course),
      kind: 'viewed',
      description: view.course.description,
      lastViewed: view.lastViewedAt.toISOString(),
    })),
    enrolled: enrollments
      .map((enrollment) => ({
        ...course(enrollment.course),
        kind: 'enrolled' as const,
        status: (learningById.get(enrollment.courseId)
          ?.academicCompletionEnabled
          ? learningById.get(enrollment.courseId)!.completion.eligible
            ? 'COMPLETED'
            : enrollment.status === 'COMPLETED'
              ? 'IN_PROGRESS'
              : enrollment.status
          : enrollment.status
        )
          .toLowerCase()
          .replace('_', '-') as 'enrolled' | 'in-progress' | 'completed',
        progress:
          learningById.get(enrollment.courseId)?.progress.percentage ?? null,
        progressLabel:
          learningById.get(enrollment.courseId)?.academicCompletionEnabled ||
          learningById.get(enrollment.courseId)?.hasAcademicItems
            ? ('Course progress' as const)
            : ('Lesson progress' as const),
        certificateCode:
          certificates.find((c) => c.courseId === enrollment.courseId)?.code ||
          null,
        nextLesson:
          learningById.get(enrollment.courseId)?.progress.nextItem?.title ??
          null,
        lastAccessed:
          learningById.get(enrollment.courseId)?.progress.lastAccessedAt ??
          null,
        learningTarget: learningById.has(enrollment.courseId)
          ? {
              destinationId: `lms-course-${enrollment.courseId}`,
              ...(learningById.get(enrollment.courseId)?.progress.nextItem
                ? {
                    item: learningById.get(enrollment.courseId)!.progress
                      .nextItem! as {
                      id: string;
                      type: 'LESSON' | 'QUIZ' | 'ASSESSMENT' | 'ASSIGNMENT';
                    },
                  }
                : {}),
            }
          : null,
      }))
      .sort((a, b) =>
        (b.lastAccessed || '').localeCompare(a.lastAccessed || ''),
      ),
  };
}
export async function getResources(): Promise<{
  resources: Resource[];
  registry: ResourceRegistry;
}> {
  const records = await (await studentRepository()).resources();
  const targets: Record<string, string> = {};
  const resources: Resource[] = records.map((record) => {
    const deliverable = Boolean(
      process.env.RESOURCE_FILES_ROOT && record.storageKey,
    );
    if (deliverable) {
      targets[`preview-${record.id}`] =
        `/api/student/resources/${record.id}/preview`;
      targets[`download-${record.id}`] =
        `/api/student/resources/${record.id}/download`;
    }
    const kind: 'pdf' | 'image' | null =
      record.mimeType === 'application/pdf'
        ? 'pdf'
        : ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(
              record.mimeType,
            )
          ? 'image'
          : null;
    return {
      id: record.id,
      title: record.title,
      description: record.description,
      category: record.category.toLowerCase() as Resource['category'],
      mimeType: record.mimeType,
      fileName: record.fileName,
      sizeBytes: record.fileSize,
      publishedAt: record.createdAt.toISOString(),
      program: record.program?.title || null,
      course: record.course?.title || null,
      access: {
        scope:
          record.audience === 'PRIVATE'
            ? ('assigned' as const)
            : ('available' as const),
        downloadTargetId: deliverable ? `download-${record.id}` : null,
      },
      preview:
        deliverable && kind ? { kind, targetId: `preview-${record.id}` } : null,
    };
  });
  const certificates = await new Academics(
    getDatabase(),
    await getCurrentStudent(),
  ).certificates();
  for (const c of certificates.filter((c) => c.documentAvailable)) {
    targets[`preview-certificate-${c.code}`] =
      `/api/lms/academic/certificates/${c.code}/preview`;
    targets[`download-certificate-${c.code}`] =
      `/api/lms/academic/certificates/${c.code}/download`;
    resources.push({
      id: `certificate-${c.code}`,
      title: `${c.course} certificate`,
      description: 'Issued for completed course requirements.',
      category: 'certificates',
      mimeType: 'application/pdf',
      fileName: c.fileName || 'certificate.pdf',
      sizeBytes: null,
      publishedAt: c.issuedAt,
      program: null,
      course: c.course,
      access: {
        scope: 'assigned',
        downloadTargetId: `download-certificate-${c.code}`,
      },
      preview: { kind: 'pdf', targetId: `preview-certificate-${c.code}` },
    });
  }
  return { resources, registry: { targets, trustedOrigins: [] } };
}
type TicketRecord = Awaited<ReturnType<StudentRepository['ticket']>>;
export function ticketView(
  record: Omit<TicketRecord, 'messages'> & {
    messages?: TicketRecord['messages'];
  },
): SupportTicket {
  return {
    id: record.id,
    reference: record.reference,
    subject: record.subject,
    category: supportCategories.includes(record.category as SupportCategory)
      ? (record.category as SupportCategory)
      : 'Other',
    status: record.status
      .toLowerCase()
      .replace('_', '-') as SupportTicketStatus,
    updatedAt: record.updatedAt.toISOString(),
    messages: (record.messages || [])
      .slice()
      .reverse()
      .map((message) => ({
        id: message.id,
        author: message.actor === 'STAFF' ? 'staff' : 'student',
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
  };
}
export async function getTickets() {
  return (await (await studentRepository()).tickets()).map(ticketView);
}
export async function getTicket(id: string) {
  return ticketView(await (await studentRepository()).ticket(id));
}
export async function getReferral(): Promise<{
  summary: ReferralSummary;
  registry: ReferralRegistry;
}> {
  const { identity, history } = await (await studentRepository()).referral();
  const origin = referralOrigin();
  return {
    summary: {
      code: identity.code,
      linkTargetId: 'personal',
      history: history.map((record, index) => ({
        id: String(index),
        displayName: 'MentoraLM member',
        status: 'joined',
        date: record.joinedAt.toISOString(),
      })),
    },
    registry: {
      links: origin ? { personal: `${origin}/invite/${identity.code}` } : {},
      trustedOrigins: origin ? [origin] : [],
    },
  };
}
export async function getProfile() {
  return (await studentRepository()).profile();
}
