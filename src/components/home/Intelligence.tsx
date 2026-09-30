import { Icon } from '@/components/ui/Icon';
import { NoticeButton } from '@/components/ui/NoticeButton';
import { notices } from '@/content/home';
export function Intelligence() {
  return (
    <section
      className="section intelligence"
      aria-labelledby="intelligence-heading"
    >
      <div className="container intelligence__grid">
        <div className="intelligence__diagram" aria-hidden="true">
          <div className="intelligence__ring" />
          <div className="intelligence__ring intelligence__ring--inner" />
          <span className="intelligence__center">
            <Icon name="spark" />
            <small>MENTORALM</small>
          </span>
          <span className="intelligence__node intelligence__node--ai">
            AI intelligence
          </span>
          <span className="intelligence__node intelligence__node--human">
            Human perspective
          </span>
          <span className="intelligence__node intelligence__node--you">
            Your ambition
          </span>
        </div>
        <div data-reveal>
          <p className="eyebrow eyebrow--light">The MentoraLM vision</p>
          <h2 id="intelligence-heading">
            Technology sees patterns.
            <br />
            <em>People see you.</em>
          </h2>
          <p>
            We believe better guidance lives where intelligence meets empathy.
            MentoraLM is designed around the possibilities of AI, the
            perspective of counsellors and mentors, and the things that make
            you, you.
          </p>
          <NoticeButton
            {...notices.menti}
            className="text-link text-link--light"
            arrow
          >
            Meet the idea behind Menti
          </NoticeButton>
          <p className="intelligence__disclaimer">
            Menti and personalized AI insights are part of our future vision,
            not live features.
          </p>
        </div>
      </div>
    </section>
  );
}
