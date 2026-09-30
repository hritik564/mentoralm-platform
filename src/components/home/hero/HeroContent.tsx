import { ButtonLink } from '@/components/ui/ButtonLink';
import { NoticeButton } from '@/components/ui/NoticeButton';
import { Icon } from '@/components/ui/Icon';
import { notices } from '@/content/home';

export function HeroContent() {
  return (
    <div className="hero-content">
      <p className="eyebrow eyebrow--light hero-enter hero-enter--eyebrow">
        <span className="status-dot" />
        Intelligence meets possibility
      </p>
      <h1
        id="hero-heading"
        aria-label="Your Future Deserves More Than a Guess."
        className="type-display hero-enter hero-enter--headline"
      >
        <span>Your Future</span>
        <span>Deserves More</span>
        <span>
          Than <em>a Guess.</em>
        </span>
      </h1>
      <p className="hero-introduction type-body hero-enter hero-enter--copy">
        MentoraLM is being built to connect AI, human expertise, career
        intelligence, education, skills, and global opportunities — so you can
        move forward with purpose.
      </p>
      <div className="hero-actions hero-enter hero-enter--actions">
        <ButtonLink
          href="#programs"
          variant="light"
          className="hero-primary-action"
        >
          Explore Programs
        </ButtonLink>
        <NoticeButton {...notices.menti} className="hero-menti-action">
          <Icon name="spark" />
          Meet Menti<span className="hero-coming-soon">Coming soon</span>
        </NoticeButton>
      </div>
      <p className="hero-microcopy">
        <span aria-hidden="true" />
        Not just a course. A connected journey.
      </p>
    </div>
  );
}
