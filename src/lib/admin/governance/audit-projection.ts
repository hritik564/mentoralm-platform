import 'server-only';
import { adminPermissions } from '../permissions';
export const auditRegistry: Record<
  string,
  { category: string; target: string; label: string }
> = Object.create(null);
function register(actions: string[], category: string, target: string) {
  for (const action of actions)
    auditRegistry[action] = {
      category,
      target,
      label: action.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2'),
    };
}
register(
  [
    'AdditionalRoleChanged',
    'AdminPolicyChanged',
    'LOCAL_GOVERNANCE_BOOTSTRAP',
    'LOCAL_ADMIN_ROLE_GRANTED',
    'LOCAL_ADMIN_ROLE_REVOKED',
  ],
  'Access',
  'User',
);
register(
  ['BatchCreated', 'BatchUpdated', 'BatchInstructorChanged'],
  'Batches',
  'Batch',
);
register(['BatchMembershipChanged'], 'Batches', 'User');
register(
  [
    'LiveSessionCreated',
    'LiveSessionUpdated',
    'RecordingUploadRequested',
    'RecordingUploadBound',
    'RecordingCleanupRequested',
    'RecordingCleanupConfirmed',
    'RecordingStorageConfirmed',
    'RecordingMETADATA',
    'RecordingPUBLISH',
    'RecordingUNPUBLISH',
  ],
  'Batches',
  'Live Session',
);
register(['ProgramSaved'], 'Academics', 'Program');
register(['CourseSaved', 'COURSE_RECONCILE'], 'Academics', 'Course');
register(
  ['SectionSaved', 'SectionOrdered', 'SectionDeleted'],
  'Academics',
  'Section',
);
register(
  [
    'LearningItemSaved',
    'LearningItemOrdered',
    'LearningItemDeleted',
    'LessonSaved',
    'LearningResourceSaved',
    'AcademicActivitySaved',
    'AssignmentSaved',
    'AcademicAssetUploadRequested',
    'AcademicAssetAttached',
    'AcademicAssetCleanupPending',
    'AcademicAssetCleanupConfirmed',
  ],
  'Academics',
  'Learning item',
);
register(['QuestionBankSaved'], 'Academics', 'Question bank');
register(['QuestionSaved'], 'Academics', 'Question');
register(['AcademicResponseReviewed'], 'Academics', 'Assessment response');
register(['ASSIGNMENT_REVIEW'], 'Academics', 'Submission version');
register(['SubmissionFileInspected'], 'Academics', 'Private submission file');
register(['BulkLmsAccessFailed'], 'Access operations', 'Student access');
register(
  [
    'CertificatePolicyIssue',
    'CertificateAdminSUSPEND',
    'CertificateAdminRESTORE',
    'CertificateAdminREVOKE',
    'CERTIFICATE_REVOKE',
  ],
  'Certificates',
  'Certificate',
);
register(['DiscussionLockChanged'], 'Discussions', 'Thread');
register(['SupportAdminAction'], 'Support', 'Ticket');
register(['COMMUNICATION_PLANNED'], 'Communications', 'Message');
register(
  ['LOCAL_OWNER_SEED', 'LOCAL_OWNER_SEED_RESET'],
  'Local tooling',
  'Local seed lifecycle',
);
for (const a of ['UNRECORDED', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
  for (const b of ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'])
    register([`ATTENDANCE_${a}_TO_${b}`], 'Attendance', 'Live Session');
for (const [kind, values] of [
  ['STUDENT_OVERRIDE', ['null', 'ENABLED', 'DISABLED']],
  ['BATCH_ACCESS', ['true', 'false']],
  ['ENROLLMENT', ['null', 'ENROLLED', 'IN_PROGRESS', 'COMPLETED']],
] as const)
  for (const a of values)
    for (const b of values)
      register(
        [`${kind}_${a}_TO_${b}`],
        'Access operations',
        kind === 'BATCH_ACCESS' ? 'Batch' : 'Student access',
      );
for (const channel of ['EMAIL', 'WHATSAPP', 'IN_APP'])
  for (const purpose of ['OPERATIONAL', 'MARKETING'])
    for (const op of ['ENABLE', 'DISABLE'])
      register(
        [`COMMUNICATION_PREFERENCE_${channel}_${purpose}_${op}`],
        'Communications',
        'Communication preference',
      );
export function safeAuditAction(action: string) {
  return auditRegistry[action]?.label || 'Unrecognized historical operation';
}
const allowedWords = new Set<string>([
  ...adminPermissions,
  'SCOPED',
  'GOVERNANCE',
  'STUDENT',
  'ADMIN',
  'INSTRUCTOR',
  'PRESENT',
  'ABSENT',
  'LATE',
  'EXCUSED',
  'UNRECORDED',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'ACCEPTED',
  'ENABLED',
  'DISABLED',
  'PLANNED',
  'HELD',
  'CANCELLED',
  'ENROLLED',
  'COMPLETED',
  'PENDING_PROVIDER',
  'SUPPRESSED',
  'EMAIL',
  'WHATSAPP',
  'IN_APP',
  'OPERATIONAL',
  'MARKETING',
  'grant',
  'revoke',
]);
const fields = [
  'beforeStatus',
  'afterStatus',
  'beforeAuthority',
  'afterAuthority',
  'beforePermissions',
  'afterPermissions',
  'beforePoints',
  'afterPoints',
  'beforeHold',
  'afterHold',
  'beforeLocked',
  'afterLocked',
  'before',
  'after',
  'role',
  'operation',
  'changed',
  'replyCreated',
  'feedbackChanged',
  'reviewPending',
  'policyChecked',
  'pending',
  'suppressed',
];
export function safeAuditSummary(action: string, raw: unknown) {
  if (
    !auditRegistry[action] ||
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw)
  )
    return [] as string[];
  const details = raw as Record<string, unknown>,
    summary: string[] = [];
  for (const key of fields) {
    const v = details[key];
    let value: string | undefined;
    if (typeof v === 'boolean') value = v ? 'Yes' : 'No';
    else if (
      typeof v === 'number' &&
      Number.isFinite(v) &&
      v >= 0 &&
      v <= 1000000
    )
      value = String(v);
    else if (typeof v === 'string' && allowedWords.has(v)) value = v;
    else if (v === null) value = 'None';
    else if (
      Array.isArray(v) &&
      v.length <= 12 &&
      v.every((x) => typeof x === 'string' && allowedWords.has(x))
    )
      value = v.join(', ') || 'None';
    if (value !== undefined)
      summary.push(`${key.replace(/([a-z])([A-Z])/g, '$1 $2')}: ${value}`);
  }
  return summary.slice(0, 12);
}
