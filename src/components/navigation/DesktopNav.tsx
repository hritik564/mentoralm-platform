import { navigation } from '@/content/home';
import { ModulesDropdown } from './ModulesDropdown';

export function DesktopNav({ homeHref = '' }: { homeHref?: string }) {
  return (
    <nav aria-label="Main navigation" className="desktop-navigation">
      <ModulesDropdown homeHref={homeHref} />
      {navigation.slice(1).map((item) => (
        <a key={item.href} href={`${homeHref}${item.href}`}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
