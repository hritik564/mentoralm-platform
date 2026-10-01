export const supportCategories = [
  'General',
  'Courses',
  'Account',
  'Technical',
  'Payments / Enrollment',
  'Other',
] as const;
export type SupportCategory = (typeof supportCategories)[number];
export type SupportTicketStatus =
  'open' | 'in-progress' | 'resolved' | 'closed';
export interface SupportMessage {
  id: string;
  author: 'student' | 'staff';
  body: string;
  createdAt: string;
}
export interface SupportTicket {
  id: string;
  reference: string;
  subject: string;
  category: SupportCategory;
  status: SupportTicketStatus;
  updatedAt: string;
  messages: readonly SupportMessage[];
}
export interface TicketDraft {
  category: SupportCategory;
  subject: string;
  message: string;
}
export type TicketErrors = Partial<Record<keyof TicketDraft, string>>;
export const ticketStatusLabels: Record<SupportTicketStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};
export function validateTicketDraft(draft: TicketDraft): TicketErrors {
  const errors: TicketErrors = {};
  if (!supportCategories.includes(draft.category))
    errors.category = 'Choose a support category.';
  if (!draft.subject.trim()) errors.subject = 'Enter a subject.';
  else if (draft.subject.length > 120)
    errors.subject = 'Keep the subject within 120 characters.';
  if (!draft.message.trim()) errors.message = 'Describe the issue.';
  else if (draft.message.length > 4000)
    errors.message = 'Keep the message within 4,000 characters.';
  return errors;
}
