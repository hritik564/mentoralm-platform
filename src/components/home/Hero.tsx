import '@/styles/hero.css';
import { HeroExperience } from './hero/HeroExperience';
import { HeroContent } from './hero/HeroContent';
import { HeroVisual } from './hero/HeroVisual';
import { GlobalHorizon } from './hero/GlobalHorizon';

export function Hero() {
  return (
    <HeroExperience>
      <div className="hero__ambient hero-atmosphere" aria-hidden="true" />
      <div className="container hero-layout">
        <HeroContent />
        <HeroVisual />
      </div>
      <GlobalHorizon />
      <noscript>
        <style>{`
          .hero--cinematic * { animation: none !important; }
          .hero-motion-control { display: none; }
        `}</style>
      </noscript>
    </HeroExperience>
  );
}
