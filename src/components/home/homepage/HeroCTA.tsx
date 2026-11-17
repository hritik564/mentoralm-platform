import { Icon } from '@/components/ui/Icon';
import { websiteHref } from '@/lib/platform/domains';
export function HeroCTA() {
  return (
    <div className="homepage-hero-statement">
      <h1 id="homepage-heading">
        Your Future, Powered by <span>MentoraLM</span>
      </h1>
      <p>
        MentoraLM connects career guidance, learning, and opportunities
        <br className="homepage-desktop-break" /> in one powerful platform for
        students across India.
      </p>
      <a
        className="homepage-button homepage-button--primary"
        href={websiteHref('/sign-up')}
      >
        Get Started Today <Icon name="arrow" />
      </a>
    </div>
  );
}
