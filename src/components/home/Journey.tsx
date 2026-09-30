import { journey } from '@/content/home';
import { Icon } from '@/components/ui/Icon';
export function Journey() {
  return (
    <section
      id="journey"
      className="section journey"
      aria-labelledby="journey-heading"
    >
      <div className="container">
        <div className="section-heading" data-reveal>
          <div>
            <p className="eyebrow">A journey, not a shortcut</p>
            <h2 id="journey-heading">
              Clarity is where it starts.
              <br />
              <em>Progress is where it goes.</em>
            </h2>
          </div>
          <p>
            You don’t need every answer today.
            <br />
            Just a more intentional next step.
          </p>
        </div>
        <ol className="journey__path">
          {journey.map((step) => (
            <li key={step.number} data-reveal>
              <div className="journey__node">
                <span>{step.number}</span>
                <Icon name="arrow" />
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <span className="journey__note">{step.note}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
