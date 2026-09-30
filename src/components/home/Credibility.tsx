import { Icon } from '@/components/ui/Icon';
export function Credibility() {
  return (
    <section className="credibility" aria-label="The MentoraLM philosophy">
      <div className="container credibility__grid">
        <p>
          Built around your future.
          <br />
          <strong>Not a one-size-fits-all answer.</strong>
        </p>
        <span>
          <Icon name="spark" />
          Intelligence-led
        </span>
        <span>
          <Icon name="mentor" />
          Human-centered
        </span>
        <span>
          <Icon name="globe" />
          Globally minded
        </span>
      </div>
    </section>
  );
}
