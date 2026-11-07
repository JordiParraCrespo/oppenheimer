// uncatalogued: brand art (the product's name); nothing hand-built competes with it
import type * as React from 'react';

import { cn } from '../lib/utils';
import { BrandMark } from './brand-mark';

/**
 * Wordmark — the mark, then the name: `BrandMark` at 1.2 times `size`, and
 * "Oppenheimer" in SF Pro Display at 600 with -0.032em tracking, sized with
 * `size` in px. The mark is decorative here; the name is what is read.
 */
function Wordmark({
  size = 18,
  className,
  style,
  ...props
}: React.ComponentProps<'span'> & { size?: number }) {
  return (
    <span
      data-slot="wordmark"
      className={cn(
        'inline-flex items-center gap-[0.4em] font-display font-semibold leading-none tracking-[-0.032em] whitespace-nowrap text-fg',
        className,
      )}
      style={{ fontSize: size, ...style }}
      {...props}
    >
      <BrandMark size={Math.round(size * 1.2)} aria-hidden="true" />
      Oppenheimer
    </span>
  );
}

export { Wordmark };
