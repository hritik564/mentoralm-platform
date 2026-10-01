import 'server-only';
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
    enrolled: enrollments.map((enrollment) => ({
      ...course(enrollment.course),
      kind: 'enrolled',
      status: enrollment.status.toLowerCase().replace('_', '-') as
        'enrolled' | 'in-progress' | 'completed',
      progress: null,
      nextLesson: null,
      lastAccessed: null,
      learningTarget: null,
    })),
  };
}
export async function getResources(): Promise<{
  resources: Resource[];
  registry: ResourceRegistry;
}> {
  const records = await (await studentRepository()).resources();
  const targets: Record<string, string> = {};
  const resources = records.map((record) => {
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
