import Image from 'next/image';
import { Icon } from '@/components/ui/Icon';
export function HumanStories() {
  return (
    <section
      id="resources"
      className="section human-stories"
      aria-labelledby="human-heading"
    >
      <div className="container human-stories__grid">
        <div data-reveal>
          <p className="eyebrow">The human side of progress</p>
          <h2 id="human-heading">
            Not everyone starts
            <br />
            in the same place.
            <br />
            <em>Everyone deserves direction.</em>
          </h2>
          <p>
            A first career decision. A new skill. A leap into a bigger world.
            Behind every next step is a person with a story worth understanding.
          </p>
          <div className="human-stories__note">
            <Icon name="mentor" />
            <p>
              Real journeys belong here.
              <br />
              <span>
                Approved learner stories and guidance resources will be shared
                as they become available.
              </span>
            </p>
          </div>
        </div>
        <figure className="human-stories__image" data-reveal>
          <Image
            src="/images/collaboration.webp"
            alt="Illustrative scene of learners sharing ideas, not a MentoraLM testimonial"
            fill
            sizes="(max-width: 760px) 90vw, 42vw"
          />
          <figcaption>
            Illustrative imagery. No learner outcomes or testimonials are
            claimed.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
