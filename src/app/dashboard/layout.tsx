import type { Metadata } from 'next';
import { requireStudentIdentity } from '@/lib/auth/session';
import { DashboardSession } from '@/components/dashboard/DashboardSession';
import '@/styles/dashboard.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Student Dashboard',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStudentIdentity();
  return <DashboardSession user={user}>{children}</DashboardSession>;
}
