import { CheckIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * SuccessMark — the ring at the top of Ready: 52px, a 1.5px primary border on
 * the selected-surface tint, a primary check inside. It enters with a 320ms
 * scale-and-fade on the system's out curve, and holds still under reduced
 * motion. The one place the action blue is decorative, because the action is
 * done.
 *
 * ```tsx
 * <SuccessMark />
 * <SuccessMark size="sm" />
 * ```
 */
function SuccessMark({
  size = 'md',
  label = 'Done',
  className,
  ...props
}: React.ComponentProps<'span'> & { size?: 'sm' | 'md'; label?: string }) {
  return (
    <span
      data-slot="success-mark"
      data-size={size}
      role="img"
      aria-label={label}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-pill border-[1.5px] border-primary bg-selected-surface text-primary motion-safe:animate-success-in',
        size === 'md' ? 'size-[52px] [&_svg]:size-6' : 'size-9 [&_svg]:size-4',
        className,
      )}
      {...props}
    >
      <CheckIcon strokeWidth={2} aria-hidden />
    </span>
  );
}

export { SuccessMark };
