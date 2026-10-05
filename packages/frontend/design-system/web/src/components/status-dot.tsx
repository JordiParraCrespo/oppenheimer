import { cva, type VariantProps } from 'class-variance-authority';
import { CheckIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

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
      // The routine vocabulary: active and paused are a routine's own states,
      // beside the run states above. Paused is muted, not coloured.
      active: 'bg-success',
      paused: 'bg-fg-subtle',
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
  active: 'Active',
  paused: 'Paused',
};

/**
 * StatusDot — status is a dot, not an icon. A 6px coloured dot plus a word,
 * which is how run state reads everywhere: the session list, the host pairing
 * step, the terminal tab. These states are the vocabulary; do not invent
 * "In progress" or "Error" alongside them.
 *
 * `completed` swaps the dot for a small green check (the connected-host and
 * connected-GitHub rows). `meta` adds a muted second line under the label.
 * `pulse` animates the dot for a live "waiting…" state; it stops under
 * reduced motion.
 */
function StatusDot({
  state = 'idle',
  children,
  meta,
  pulse,
  density = 'default',
  className,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof dotVariants> & {
    meta?: React.ReactNode;
    pulse?: boolean;
    /**
     * `compact` is a routine's status in a table row or a page's facts: a
     * slightly larger dot set close to its word, no column for a check, and a
     * paused routine's word muted.
     */
    density?: 'default' | 'compact';
  }) {
  const resolved = state ?? 'idle';
  const compact = density === 'compact';
  return (
    <span
      data-slot="status-dot"
      data-state={resolved}
      data-density={density}
      className={cn(
        'inline-flex text-operate text-fg',
        compact
          ? 'items-center gap-1.75 text-sm data-[state=paused]:text-fg-muted'
          : 'items-start gap-2.5',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center',
          compact ? '[&>span]:size-1.75' : 'h-[1.4em] w-4',
        )}
      >
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
