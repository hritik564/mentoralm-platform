import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate } from './runtime';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
};

export default function Link({
  href,
  prefetch: _prefetch,
  replace,
  onClick,
  ...props
}: Props) {
  void _prefetch;
  function click(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target === '_blank'
    )
      return;
    event.preventDefault();
    navigate(href, replace);
  }
  return <a {...props} href={href} onClick={click} />;
}
