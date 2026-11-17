import type { ImgHTMLAttributes } from 'react';

type Props = ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean };
export default function Image({ unoptimized: _unoptimized, ...props }: Props) {
  void _unoptimized;
  // Test-only adapter; production continues to use Next Image unchanged.
  // eslint-disable-next-line @next/next/no-img-element -- Isolated fixture adapter, no optimized image server.
  return <img {...props} />;
}
