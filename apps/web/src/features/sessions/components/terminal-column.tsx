import { cn } from '@oppenheimer/design-system-web';
import type { ComponentProps } from 'react';

/**
 * A session's measure: a 1040px column with its 20px gutter, so mono output
 * keeps a readable line on a wide display. The terminal's grid and the chat's
 * turns and composer all stand in it, so Terminal / Chat moves neither edge
 * of the text; what scrolls or covers the pane stays outside it, at the
 * pane's full width.
 */
export function TerminalColumn({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-260 px-5', className)} {...props} />;
}
