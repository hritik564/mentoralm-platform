import type { ReactNode } from 'react';
import { navigation } from '@/content/home';
import { Icon } from '@/components/ui/Icon';
import { NavActions } from './NavActions';
import { ModulesDropdown } from './ModulesDropdown';

export function MobileNav({
  open,
  onClose,
  accountActions,
}: {
  open: boolean;
  onClose: () => void;
  accountActions?: ReactNode;
}) {
  return (
    <div id="mobile-navigation" className="mobile-navigation" hidden={!open}>
      <nav
        aria-label="Mobile navigation"
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('a'))
            onClose();
        }}
      >
        {open && <ModulesDropdown mobile />}
        {navigation.slice(1).map((item, index) => (
          <a key={item.href} href={item.href}>
            <span className="mobile-navigation__number">0{index + 2}</span>
            {item.label}
            <Icon name="arrow-up" />
          </a>
        ))}
        <div className="mobile-navigation__actions">
          <NavActions accountActions={accountActions} />
        </div>
      </nav>
    </div>
  );
}
