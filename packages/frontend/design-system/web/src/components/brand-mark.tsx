// uncatalogued: brand art (the product's mark); nothing hand-built competes with it
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * BrandMark — the product's mark: a white fedora on an ink tile, the same in
 * both themes the way an app icon is (`--brand-tile`, `--brand-hat`). The
 * favicons and the extension's icons are this drawing. Size it with `size`
 * (px) or a `size-*` utility on `className`.
 */
function BrandMark({ className, size = 24, ...props }: React.ComponentProps<'svg'> & { size?: number }) {
  return (
    <svg
      data-slot="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Oppenheimer"
      className={cn('shrink-0', className)}
      {...props}
    >
      <rect width="64" height="64" rx="14" fill="var(--brand-tile)" />
      <g fill="var(--brand-hat)" transform="translate(6.4 4) scale(.8)">
        <path d="M16 37 19.3 15.5C20 10.6 23.6 8.6 27.6 10.2L32 12l4.4-1.8c4-1.6 7.6.4 8.3 5.3L48 37Z" />
        <path d="M3 46.2c0-2.6 6.5-3.3 15-2.9h28c8.5-.4 15 .3 15 2.9C61 51.5 48 55.5 32 55.5S3 51.5 3 46.2Z" />
      </g>
    </svg>
  );
}

export { BrandMark };
