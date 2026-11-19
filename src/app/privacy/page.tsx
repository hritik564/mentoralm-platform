import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { privacy20261119 } from '@/content/legal/privacy-2026-11-19-v1';
export const dynamic = 'force-static';
export const metadata: Metadata = {
  title: { absolute: 'Privacy Policy | MentoraLM' },
  description:
    'How MentoraLM handles personal data, learning and purchase records, security, privacy rights and grievances.',
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Privacy Policy | MentoraLM',
    description:
      'How MentoraLM handles personal data, learning and purchase records, security, privacy rights and grievances.',
    url: '/privacy',
    type: 'website',
  },
};
export default function Page() {
  return <LegalDocument markdown={privacy20261119.markdown} />;
}
