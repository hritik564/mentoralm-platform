import { Brand } from './Brand';
import { programs } from '@/content/programs';
import { notices } from '@/content/home';
import { websiteHref } from '@/lib/platform/domains';
import { NoticeButton } from '@/components/ui/NoticeButton';
import { Icon } from '@/components/ui/Icon';
import Link from 'next/link';
export function Footer({ homeHref = '' }: { homeHref?: string }) {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <Brand href={homeHref || '#top'} />
            <p>
              Intelligence. Possibility.
              <br />A future that feels like you.
            </p>
            <span className="footer__location">
              <Icon name="globe" />A global outlook. A personal journey.
            </span>
          </div>
          <nav className="footer__navigation" aria-label="Footer navigation">
            <div>
              <h3>Programs</h3>
              {programs
                .filter((program) => program.status === 'featured')
                .map((program) => (
                  <a
                    key={program.id}
                    href={
                      program.status === 'featured' && program.storyId
                        ? `${homeHref}#${program.storyId}`
                        : `${homeHref}#programs`
                    }
                  >
                    {program.name}
                  </a>
                ))}
              <a href={websiteHref('/courses')}>Explore All Courses</a>
            </div>
            <div>
              <h3>Explore</h3>
              <a href={`${homeHref}#opportunities`}>Opportunities</a>
              <a href={`${homeHref}#resources`}>
                Resources <small>In development</small>
              </a>
              <a href={`${homeHref}#about`}>About MentoraLM</a>
              <a href={`${homeHref}#journey`}>Our approach</a>
            </div>
            <div>
              <h3>Connect</h3>
              <NoticeButton {...notices.support}>
                Support & contact
              </NoticeButton>
              <Link href="/sign-in" prefetch={false}>
                Login
              </Link>
              <span className="footer__unavailable">
                Social channels
                <br />
                <small>Official links coming soon</small>
              </span>
            </div>
          </nav>
        </div>
        <div className="footer__bottom">
          <p>© {new Date().getFullYear()} MentoraLM. All rights reserved.</p>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="#top">
              Back to top
              <Icon name="arrow-up" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
