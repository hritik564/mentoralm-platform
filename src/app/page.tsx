import type { Metadata } from 'next';
import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from '@/components/layout/Footer';
import { MotionObserver } from '@/components/motion/MotionObserver';
import { HomepageHero } from '@/components/home/homepage/HomepageHero';
import { Credibility } from '@/components/home/Credibility';
import { MarketplacePreview } from '@/components/marketplace/MarketplacePreview';
import { Purpose } from '@/components/home/Purpose';
import { Journey } from '@/components/home/Journey';
import { Intelligence } from '@/components/home/Intelligence';
import { FeaturedStories } from '@/components/home/FeaturedStories';
import { Opportunities } from '@/components/home/Opportunities';
import { HumanStories } from '@/components/home/HumanStories';
import { FinalCta } from '@/components/home/FinalCta';

export const metadata: Metadata = {
  title: { absolute: 'Your Future, Powered by MentoraLM' },
  description:
    'MentoraLM connects career guidance, learning, and opportunities in one powerful platform for students across India.',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'MentoraLM',
    title: 'Your Future, Powered by MentoraLM',
    description:
      'MentoraLM connects career guidance, learning, and opportunities in one powerful platform for students across India.',
  },
  twitter: {
    card: 'summary',
    title: 'Your Future, Powered by MentoraLM',
    description:
      'MentoraLM connects career guidance, learning, and opportunities in one powerful platform for students across India.',
  },
};
export default function Home() {
  return (
    <div id="top" className="homepage-page">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">
        <HomepageHero />
        <Credibility />
        <MarketplacePreview />
        <Purpose />
        <Journey />
        <Intelligence />
        <FeaturedStories />
        <Opportunities />
        <HumanStories />
        <FinalCta />
      </main>
      <Footer />
      <MotionObserver />
    </div>
  );
}
