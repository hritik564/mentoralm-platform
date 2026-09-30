import { GlassSurface } from '@/components/ui/GlassSurface';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';

export type Capability = {
  id: 'learning' | 'global' | 'human' | 'career';
  title: string;
  caption: string;
  icon: IconName;
  href: string;
};

export function CapabilityCard({ capability }: { capability: Capability }) {
  return (
    <a
      href={capability.href}
      className={`hero-capability hero-capability--${capability.id} hero-enter hero-enter--card`}
    >
      <GlassSurface interactive className="hero-capability__surface">
        <span className="hero-capability__icon">
          <Icon name={capability.icon} />
        </span>
        <span>
          <strong>{capability.title}</strong>
          <span className="hero-capability__caption">{capability.caption}</span>
        </span>
      </GlassSurface>
    </a>
  );
}
