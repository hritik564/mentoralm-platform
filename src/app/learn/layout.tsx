import type { Metadata } from 'next';
import { requireStudentIdentity } from '@/lib/auth/session';
import { LmsShell } from '@/components/lms/LmsShell';
import '@/styles/lms.css';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { getLmsRepository } from '@/lib/lms/services';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'MentoraLM Learning',
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};
export default async function LmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LmsShell user={await requireStudentIdentity()}>
      <LmsBoundary
        load={async () => {
          await getLmsRepository();
          return children;
        }}
      />
    </LmsShell>
  );
}
