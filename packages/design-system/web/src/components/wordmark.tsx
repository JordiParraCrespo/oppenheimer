import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Wordmark — no logotype file exists, so the name is the mark: "Oppenheimer" in
 * SF Pro Display at 600 with -0.032em tracking. `product` appends the surface
 * name as an 11px uppercase eyebrow ("CONSOLE"), the one place uppercase is
 * allowed. Sized with `size` in px; the eyebrow scales from it.
 *
 * When a real logo lands, swap the inside of this component; nothing else moves.
 */
function Wordmark({
  size = 18,
  product,
  className,
  style,
  ...props
}: React.ComponentProps<'span'> & { size?: number; product?: string }) {
  return (
    <span
      data-slot="wordmark"
      className={cn(
        'inline-flex items-baseline gap-[0.3em] font-display font-semibold leading-none tracking-[-0.032em] whitespace-nowrap text-fg',
        className,
      )}
      style={{ fontSize: size, ...style }}
      {...props}
    >
      Oppenheimer
      {product ? (
        <span className="-translate-y-[0.15em] font-sans text-[0.42em] font-medium tracking-[0.1em] uppercase text-fg-subtle">
          {product}
        </span>
      ) : null}
    </span>
  );
}

export { Wordmark };
