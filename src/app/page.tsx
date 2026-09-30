import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from '@/components/layout/Footer';
import { MotionObserver } from '@/components/motion/MotionObserver';
import { Hero } from '@/components/home/Hero';
import { Credibility } from '@/components/home/Credibility';
import { Ecosystem } from '@/components/home/Ecosystem';
import { Purpose } from '@/components/home/Purpose';
import { Journey } from '@/components/home/Journey';
import { Intelligence } from '@/components/home/Intelligence';
import { FeaturedStories } from '@/components/home/FeaturedStories';
import { Opportunities } from '@/components/home/Opportunities';
import { HumanStories } from '@/components/home/HumanStories';
import { FinalCta } from '@/components/home/FinalCta';
export default function Home() {
  return (
    <div id="top">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">
        <Hero />
        <Credibility />
        <Ecosystem />
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
