import type { AdminPermission } from '../../generated/prisma/client';
export const adminPermissions = [
  'STUDENTS_MANAGE',
  'BATCHES_MANAGE',
  'ACADEMICS_MANAGE',
  'ATTENDANCE_MANAGE',
  'CERTIFICATES_MANAGE',
  'DISCUSSIONS_MANAGE',
  'SUPPORT_MANAGE',
  'COMMUNICATIONS_MANAGE',
  'REFERRALS_VIEW',
  'USERS_VIEW',
  'AUDIT_VIEW',
  'SETTINGS_VIEW',
] as const satisfies readonly AdminPermission[];
export const legacyAdminPermissions: AdminPermission[] = adminPermissions.slice(
  0,
  9,
);
export const operationalPermissions = {
  attendance: 'ATTENDANCE_MANAGE',
  submissions: 'ACADEMICS_MANAGE',
  attempts: 'ACADEMICS_MANAGE',
  certificates: 'CERTIFICATES_MANAGE',
  discussions: 'DISCUSSIONS_MANAGE',
  support: 'SUPPORT_MANAGE',
  communications: 'COMMUNICATIONS_MANAGE',
  referrals: 'REFERRALS_VIEW',
} as const satisfies Record<string, AdminPermission>;
const writes: Record<string, AdminPermission> = Object.fromEntries([
  ...[
    'ProgramSaved',
    'CourseSaved',
    'SectionSaved',
    'LearningItemSaved',
    'LearningItemOrdered',
    'SectionOrdered',
    'SectionDeleted',
    'LearningItemDeleted',
    'LessonSaved',
    'LearningResourceSaved',
    'AcademicActivitySaved',
    'AssignmentSaved',
    'QuestionBankSaved',
    'QuestionSaved',
    'AcademicAssetUploadRequested',
    'AcademicAssetAttached',
    'AcademicAssetCleanupPending',
    'AcademicAssetCleanupConfirmed',
    'AcademicResponseReviewed',
    'SubmissionFileInspected',
  ].map((a) => [a, 'ACADEMICS_MANAGE']),
  ...[
    'CertificatePolicyIssue',
    'CertificateAdminSUSPEND',
    'CertificateAdminRESTORE',
    'CertificateAdminREVOKE',
  ].map((a) => [a, 'CERTIFICATES_MANAGE']),
  ['DiscussionLockChanged', 'DISCUSSIONS_MANAGE'],
  ['SupportAdminAction', 'SUPPORT_MANAGE'],
]);
export function adminWritePermission(
  action: string,
): AdminPermission | undefined {
  return writes[action];
}
export function adminPathPermission(path: string): AdminPermission | null {
  const segment = path.replace(/^\/admin\/?/, '').split('/')[0];
  if (!segment) return null;
  const map: Record<string, AdminPermission> = {
    students: 'STUDENTS_MANAGE',
    batches: 'BATCHES_MANAGE',
    courses: 'ACADEMICS_MANAGE',
    'question-banks': 'ACADEMICS_MANAGE',
    assessments: 'ACADEMICS_MANAGE',
    assignments: 'ACADEMICS_MANAGE',
    instructors: 'BATCHES_MANAGE',
    users: 'USERS_VIEW',
    audit: 'AUDIT_VIEW',
    settings: 'SETTINGS_VIEW',
    ...operationalPermissions,
  };
  return map[segment] || null;
}
