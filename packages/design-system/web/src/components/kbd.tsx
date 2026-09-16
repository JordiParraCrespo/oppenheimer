import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Kbd — a keyboard glyph: an 18px capsule at the 6px radius on the control
 * fill, 11px, in the sans face so ⌘ and the letter sit at one width. Unicode
 * symbols (⌘, ⌥, ⏎) appear in the UI only inside this component.
 */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-xs bg-control px-1 font-sans text-[11px] leading-none tracking-normal text-fg-subtle',
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
