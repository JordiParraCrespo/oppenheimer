import type * as React from 'react';

import { Panel } from './panel';
import { type Step, Stepper } from './stepper';

/**
 * MergePath — what stands between a pull request and main: a `Panel` around
 * a horizontal `Stepper` of its gates (Checks, Conflicts, Review, Merge), a
 * gate met `done`, not met `failed`, still to come `pending`, each with its
 * word and one line of why. The title row counts what is done ("2 of 4
 * done"); under a hairline, `note` says what happens next ("Squash and
 * merge into main as @jordiparra", or what to fix first) beside `actions`
 * (Review changes, a `MergeButton`).
 */
function MergePath({
  title,
  summary,
  steps,
  note,
  actions,
  className,
}: {
  title: React.ReactNode;
  /** "2 of 4 done". */
  summary?: React.ReactNode;
  steps: readonly Step[];
  note?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel title={title} meta={summary} className={className}>
      <Stepper orientation="horizontal" steps={steps} />
      {note || actions ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3.5">
          <span className="min-w-45 flex-1 text-xs text-pretty text-fg-muted">{note}</span>
          {actions}
        </div>
      ) : null}
    </Panel>
  );
}

export { MergePath };
