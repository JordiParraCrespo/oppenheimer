import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Wordmark — no logotype file exists, so the name is the mark: "Oppenheimer" in
 * SF Pro Display at 600 with -0.032em tracking, sized with `size` in px.
 *
 * When a real logo lands, swap the inside of this component; nothing else moves.
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
        'inline-flex items-baseline font-display font-semibold leading-none tracking-[-0.032em] whitespace-nowrap text-fg',
        className,
      )}
      style={{ fontSize: size, ...style }}
      {...props}
    >
      Oppenheimer
    </span>
  );
}

export { Wordmark };
