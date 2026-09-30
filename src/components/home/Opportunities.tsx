import { opportunities } from '@/content/home';
import { Icon } from '@/components/ui/Icon';
export function Opportunities() {
  return (
    <section
      id="opportunities"
      className="section opportunities"
      aria-labelledby="opportunities-heading"
    >
      <div className="container">
        <div className="section-heading" data-reveal>
          <div>
            <p className="eyebrow">Beyond the classroom</p>
            <h2 id="opportunities-heading">
              The world doesn’t stand still.
              <br />
              <em>Neither should your future.</em>
            </h2>
          </div>
          <p>
            Our future opportunities ecosystem.
            <br />
            New ways to learn, connect, and grow.
          </p>
        </div>
        <div className="opportunities__grid">
          {opportunities.map((item) => (
            <article key={item.title} data-reveal>
              <Icon name={item.icon} />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className="opportunities__status">
                Planned category · No live listings
              </span>
            </article>
          ))}
        </div>
        <div className="opportunities__bottom">
          <p>These are planned categories, not current openings or offers.</p>
        </div>
        <details id="opportunity-note" className="opportunities__details">
          <summary>
            Explore Opportunities <Icon name="arrow" />
          </summary>
          <p>
            A place to discover approved internships, scholarships, career
            opportunities, events, and global education opportunities. Listings
            and application journeys will be added in a later phase.
          </p>
        </details>
      </div>
    </section>
  );
}
