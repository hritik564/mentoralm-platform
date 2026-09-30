import type { Metadata } from 'next';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/newsreader/latin-400-italic.css';
import '@/styles/tokens.css';
import '@/styles/global.css';
import '@/styles/foundation.css';
import '@/styles/navigation.css';
import '@/styles/auth.css';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { isAuthConfigured } from '@/lib/auth/config';
import { getSiteOrigin } from '@/lib/site';
const origin = getSiteOrigin();
const description =
  'Explore MentoraLM: a connected vision of career guidance, skills, global education, and opportunity. Find a starting point for your next chapter.';
export const metadata: Metadata = {
  title: {
    default: 'MentoraLM — Your Future Deserves More Than a Guess',
    template: '%s | MentoraLM',
  },
  description,
  applicationName: 'MentoraLM',
  ...(origin ? { metadataBase: origin, alternates: { canonical: '/' } } : {}),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'MentoraLM',
    title: 'Your Future Deserves More Than a Guess. — MentoraLM',
    description,
    ...(origin ? { url: '/' } : {}),
  },
  twitter: {
    card: 'summary',
    title: 'MentoraLM — Your Future Deserves More Than a Guess',
    description,
  },
  icons: { icon: '/favicon.png' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider enabled={isAuthConfigured()}>{children}</AuthProvider>
      </body>
    </html>
  );
}
