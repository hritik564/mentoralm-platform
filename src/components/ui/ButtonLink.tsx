import { Icon } from './Icon';
export function ButtonLink({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'light' | 'outline' | 'text';
  className?: string;
}) {
  return (
    <a className={`button button--${variant} ${className}`} href={href}>
      {children}
      <Icon name="arrow" />
    </a>
  );
}
