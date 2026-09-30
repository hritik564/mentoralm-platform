import { ButtonLink } from '@/components/ui/ButtonLink';
export function FinalCta() {
  return (
    <section
      id="next-chapter"
      className="final-cta"
      aria-labelledby="cta-heading"
    >
      <div className="container" data-reveal>
        <p className="eyebrow eyebrow--light">
          Your story is still being written
        </p>
        <h2 id="cta-heading">
          Your next chapter shouldn’t
          <br />
          begin with <em>a guess.</em>
        </h2>
        <p>Start with a possibility. Find a direction that feels like you.</p>
        <div className="final-cta__actions">
          <ButtonLink href="#journey" variant="light">
            Explore MentoraLM
          </ButtonLink>
          <ButtonLink href="#programs" variant="outline">
            View Programs
          </ButtonLink>
        </div>
      </div>
      <span className="final-cta__star" aria-hidden="true">
        ✳
      </span>
    </section>
  );
}
