import { Icon } from '@/components/ui/Icon';
export function Purpose() {
  return (
    <section
      id="about"
      className="section purpose"
      aria-labelledby="purpose-heading"
    >
      <div className="container purpose__grid">
        <div data-reveal>
          <p className="eyebrow">Why MentoraLM exists</p>
          <h2 id="purpose-heading">
            Too many choices.
            <br />
            <span>Not enough clarity.</span>
          </h2>
          <p className="purpose__intro">
            The world keeps opening doors.
            <br />
            Knowing which one is yours is harder.
          </p>
        </div>
        <div className="purpose__answer" data-reveal>
          <p>
            Career advice in one place. Skills in another. A world of education
            options, and no clear way to connect the dots.
          </p>
          <p>
            MentoraLM is being built to bring those pieces together — a
            connected ecosystem of guidance, learning, and opportunity, with
            your ambition at the center.
          </p>
          <a className="text-link" href="#journey">
            A more connected way forward
            <Icon name="arrow" />
          </a>
        </div>
      </div>
    </section>
  );
}
