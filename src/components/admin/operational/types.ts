import type { AdminOperationalRepository } from '@/lib/admin/operational/read';
export type List = Awaited<ReturnType<AdminOperationalRepository['list']>>;
export type Session = Awaited<
  ReturnType<AdminOperationalRepository['session']>
>;
export type Submission = Awaited<
  ReturnType<AdminOperationalRepository['submission']>
>;
export type Attempt = Awaited<
  ReturnType<AdminOperationalRepository['attempt']>
>;
export type Certificate = Awaited<
  ReturnType<AdminOperationalRepository['certificateDetail']>
>;
export type Discussion = Awaited<
  ReturnType<AdminOperationalRepository['discussion']>
>;
export type Ticket = Awaited<ReturnType<AdminOperationalRepository['ticket']>>;
export type Message = Awaited<
  ReturnType<AdminOperationalRepository['message']>
>;
export type Referral = Awaited<
  ReturnType<AdminOperationalRepository['referral']>
>;
export type OperationalOverview = Awaited<
  ReturnType<AdminOperationalRepository['overview']>
>;
