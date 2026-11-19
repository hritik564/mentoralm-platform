import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { terms20261119 } from '@/content/legal/terms-2026-11-19-v1';
export const dynamic = 'force-static';
export const metadata: Metadata = {
  title: { absolute: 'Terms and Conditions | MentoraLM' },
  description:
    'Owner-approved MentoraLM terms covering accounts, programs, purchases, access, refunds and customer support.',
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Terms and Conditions | MentoraLM',
    description:
      'Owner-approved MentoraLM terms covering accounts, programs, purchases, access, refunds and customer support.',
    url: '/terms',
    type: 'website',
  },
};
export default function Page() {
  return <LegalDocument markdown={terms20261119.markdown} />;
}
