import { cn } from '@oppenheimer/design-system-web';
import type { ComponentProps } from 'react';
import { TERMINAL_MEASURE } from '../lib/terminal-measure';

/**
 * A session's measure (`TERMINAL_MEASURE`, 760px) with its 20px gutter, so
 * mono output keeps a readable line on a wide display. The terminal's grid
 * and the chat's turns and composer all stand in it, so Terminal / Chat
 * moves neither edge of the text. Each scrolls at the column's width, its
 * scrollbar beside the text; what covers the pane (the chat's ground) stays
 * at the pane's full width.
 */
export function TerminalColumn({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn(TERMINAL_MEASURE, 'px-5', className)} {...props} />;
}
