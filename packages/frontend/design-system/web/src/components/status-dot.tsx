import { cva, type VariantProps } from 'class-variance-authority';
import { CheckIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * StatusDot — status is a dot, not an icon. A 6px coloured dot plus a word,
 * which is how run state reads everywhere: the session list, the host pairing
 * step, the terminal tab. The six states are the vocabulary; do not invent
 * "In progress" or "Error" alongside them.
 *
 * `completed` swaps the dot for a small green check (the connected-host and
 * connected-GitHub rows). `meta` adds a muted second line under the label.
 * `pulse` animates the dot for a live "waiting…" state; it stops under
 * reduced motion.
 */
const dotVariants = cva('inline-block size-1.5 shrink-0 rounded-pill', {
  variants: {
    state: {
      running: 'bg-success',
      'needs-input': 'bg-warning',
      failed: 'bg-danger',
      queued: 'bg-info',
      completed: 'bg-success',
      idle: 'bg-fg-subtle',
      pending: 'bg-border-strong',
    },
  },
  defaultVariants: { state: 'idle' },
});

type StatusState = NonNullable<VariantProps<typeof dotVariants>['state']>;

const STATUS_LABEL: Record<StatusState, string> = {
  running: 'Running',
  'needs-input': 'Needs input',
  failed: 'Failed',
  queued: 'Queued',
  completed: 'Completed',
  idle: 'Idle',
  pending: 'Pending',
};

function StatusDot({
  state = 'idle',
  children,
  meta,
  pulse,
  className,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof dotVariants> & {
    /** A muted second line under the label. */
    meta?: React.ReactNode;
    /** Animate the dot for a live wait. */
    pulse?: boolean;
  }) {
  const resolved = state ?? 'idle';
  return (
    <span
      data-slot="status-dot"
      data-state={resolved}
      className={cn('inline-flex items-start gap-2.5 text-operate text-fg', className)}
      {...props}
    >
      <span className="flex h-[1.4em] w-4 shrink-0 items-center justify-center">
        {resolved === 'completed' ? (
          <CheckIcon className="size-3.5 text-success" strokeWidth={2.5} aria-hidden />
        ) : (
          <span
            className={cn(dotVariants({ state: resolved }), pulse && 'motion-safe:animate-pulse')}
            aria-hidden
          />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate">{children ?? STATUS_LABEL[resolved]}</span>
        {meta ? <span className="text-xs text-fg-muted">{meta}</span> : null}
      </span>
    </span>
  );
}

export { STATUS_LABEL, StatusDot, dotVariants };
export type { StatusState };
