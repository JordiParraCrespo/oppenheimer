import type * as React from 'react';

import { cn } from '../lib/utils';
import { Card } from './card';
import type { Step, StepState } from './stepper';

/**
 * MergePath — what stands between a pull request and main, as the one card
 * row that opens its page. `leading` (the diff stat, "12 files in 3
 * folders") on the left; then its gates (Checks, Conflicts, Merge), each a
 * dot in its state's colour — met `done`, not met `failed`, held `running`,
 * still to come `pending` — with its label and its word ("All passing",
 * "Rebase on main", "Squash into main"); and `actions` on the right (Review
 * changes, a `MergeButton`). It wraps on a narrow pane.
 */
function MergePath({
  steps,
  leading,
  actions,
  className,
}: {
  steps: readonly Step[];
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      data-slot="merge-path"
      className={cn('min-w-0 flex-row flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5', className)}
    >
      <div className="flex min-w-0 flex-[1_1_260px] flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fg-muted">
        {leading}
        <span className="flex-1" />
        <ol className="m-0 flex list-none flex-wrap items-center gap-x-3.5 gap-y-1.5 p-0">
          {steps.map((step) => (
            <li key={step.id} data-state={step.state} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className={cn('size-1.75 shrink-0 rounded-pill', DOT[step.state])} />
              <span className="text-fg">{step.label}</span>
              {step.meta ? <span>{step.meta}</span> : null}
            </li>
          ))}
        </ol>
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </Card>
  );
}

const DOT: Record<StepState, string> = {
  done: 'bg-success',
  failed: 'bg-danger',
  running: 'bg-warning',
  pending: 'bg-fg-subtle',
};

export { MergePath };
