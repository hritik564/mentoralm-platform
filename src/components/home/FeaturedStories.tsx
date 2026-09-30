import Image from 'next/image';
import { programs } from '@/content/programs';
import { Icon } from '@/components/ui/Icon';
import { NoticeButton } from '@/components/ui/NoticeButton';
const stories = [
  {
    programId: 'ai-career',
    headline: (
      <>
        Before choosing a path,
        <br />
        <em>understand yourself.</em>
      </>
    ),
    copy: 'Your interests, strengths, and ambitions deserve more than generic advice. Our career counselling vision starts with the person behind the decision.',
    image: '/images/learner.webp',
    alt: 'Illustrative portrait of a thoughtful young learner',
    tag: 'Clarity before the next step',
    imageClass: 'story__photo--portrait',
  },
  {
    programId: 'careerignite',
    headline: (
      <>
        Ambition is a beginning.
        <br />
        <em>Build what comes next.</em>
      </>
    ),
    copy: 'Give your next chapter something to stand on. CareerIgnite is centered on the skills, confidence, and preparation that turn intention into forward momentum.',
    image: '/images/collaboration.webp',
    alt: 'Illustrative scene of young adults collaborating around a notebook and laptop',
    tag: 'From possibility to preparation',
    imageClass: '',
  },
  {
    programId: 'gradlm',
    headline: (
      <>
        A bigger world.
        <br />
        <em>A more personal journey.</em>
      </>
    ),
    copy: 'Studying abroad is more than choosing a destination. GradLM is the MentoraLM pathway for exploring global education with your aspirations at the center.',
    image: '/images/campus.webp',
    alt: 'Illustrative student exploring a historic university courtyard',
    tag: 'Your ambition, without borders',
    imageClass: '',
  },
] as const;
export function FeaturedStories() {
  return (
    <section
      className="section featured-stories"
      aria-labelledby="stories-heading"
    >
      <div className="container">
        <p className="eyebrow" data-reveal>
          A closer look at the possibilities
        </p>
        <h2
          id="stories-heading"
          className="featured-stories__heading"
          data-reveal
        >
          Different ambitions.
          <br />
          <em>The same belief in you.</em>
        </h2>
        {stories.map((story, index) => {
          const program = programs.find((item) => item.id === story.programId);
          if (!program || program.status !== 'featured') return null;
          return (
            <article
              key={program.id}
              id={program.storyId}
              className={`story accent-${program.accent} ${index % 2 ? 'story--reverse' : ''}`}
              data-reveal
            >
              <div className={`story__photo ${story.imageClass}`}>
                <Image
                  src={story.image}
                  alt={story.alt}
                  fill
                  sizes="(max-width: 760px) 90vw, 45vw"
                />
                <span className="story__photo-tag">
                  <Icon name={program.symbol} />
                  {story.tag}
                </span>
              </div>
              <div className="story__copy">
                <span className="story__program">
                  {program.name}
                  <span>{program.label}</span>
                </span>
                <h3>{story.headline}</h3>
                <p>{story.copy}</p>
                <NoticeButton
                  className="text-link"
                  arrow
                  title={program.name}
                  description={`${program.description} Full program details, eligibility, and enrollment information are not available in this preview. They will be shared in a later release.`}
                >
                  {program.direction}
                </NoticeButton>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
