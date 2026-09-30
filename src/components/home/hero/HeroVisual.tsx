import Image from 'next/image';
import { CapabilityCard } from './CapabilityCard';
import type { Capability } from './CapabilityCard';
import { IntelligencePaths } from './IntelligencePaths';
import { Menti } from '@/components/menti/Menti';
import { MentiInteraction } from '@/components/menti/MentiInteraction';
import { MentiSpeechBubble } from '@/components/menti/MentiSpeechBubble';

const capabilities: readonly Capability[] = [
  {
    id: 'learning',
    title: 'Personalized Learning Paths',
    caption: 'A direction that fits you',
    icon: 'create',
    href: '#journey',
  },
  {
    id: 'global',
    title: 'Global Opportunities',
    caption: 'Think beyond borders',
    icon: 'globe',
    href: '#story-gradlm',
  },
  {
    id: 'human',
    title: 'Human Expertise',
    caption: 'Real people. Fresh perspective.',
    icon: 'mentor',
    href: '#about',
  },
  {
    id: 'career',
    title: 'Career Intelligence',
    caption: 'Clarity for your next chapter',
    icon: 'briefcase',
    href: '#story-ai-career',
  },
];

export function HeroVisual() {
  return (
    <div className="hero-visual">
      <div className="menti-dock hero-enter hero-enter--menti">
        <MentiInteraction>
          <Menti />
        </MentiInteraction>
        <MentiSpeechBubble />
      </div>
      <div className="hero-visual__scene">
        <IntelligencePaths />
        <figure className="hero-student hero-enter hero-enter--student">
          <Image
            src="/images/learner.webp"
            alt="Illustrative portrait of a young learner looking ahead with confidence"
            fill
            priority
            sizes="(max-width: 640px) 80vw, (max-width: 900px) 480px, (max-width: 1100px) 40vw, 480px"
          />
          <span className="hero-student__shade" aria-hidden="true" />
        </figure>
        <div
          className="hero-capabilities"
          role="group"
          aria-label="Explore the MentoraLM ecosystem vision"
        >
          {capabilities.map((capability) => (
            <CapabilityCard key={capability.id} capability={capability} />
          ))}
        </div>
        <span className="hero-scene-star" aria-hidden="true">
          ✦
        </span>
      </div>
    </div>
  );
}
