import { navigation } from '@/content/home';
import { ModulesDropdown } from './ModulesDropdown';

export function DesktopNav() {
  return (
    <nav aria-label="Main navigation" className="desktop-navigation">
      <ModulesDropdown />
      {navigation.slice(1).map((item) => (
        <a key={item.href} href={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
