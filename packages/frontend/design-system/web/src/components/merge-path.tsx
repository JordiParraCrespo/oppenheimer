import { CheckIcon, CircleAlertIcon, MinusIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Panel } from './panel';

/**
 * MergePath — what stands between a pull request and main, as steps across
 * a `Panel`: Checks, Conflicts, Review, Merge. A step is done (a green tick
 * on the green wash, and the rail after it green), blocked (the alert on
 * the red wash) or still to come (a dash on the hover wash); each has its
 * word and one line of why. The title row counts what is done ("2 of 4
 * done"); under a hairline, `note` says what happens next ("Squash and
 * merge into main as @jordiparra", or what to fix first) beside `actions`
 * (Review changes, a `MergeButton`).
 *
 * The check here marks a finished gate, not a live state, which is why it
 * may appear outside a run list.
 */

type MergeStepState = 'done' | 'blocked' | 'pending';

interface MergeStep {
  label: React.ReactNode;
  detail?: React.ReactNode;
  state: MergeStepState;
}

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
  steps: readonly MergeStep[];
  note?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel title={title} meta={summary} className={className}>
      <ol
        data-slot="merge-path"
        className="m-0 grid list-none p-0"
        // biome-ignore lint/style/noInlineStyles: the step count is data.
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional.
            key={i}
            data-state={step.state}
            className="flex min-w-0 flex-col gap-2.5"
          >
            <span className="flex items-center">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-pill [&_svg]:size-[13px]',
                  step.state === 'done' && 'bg-success/15 text-success',
                  step.state === 'blocked' && 'bg-danger/12 text-danger',
                  step.state === 'pending' && 'bg-hover-surface text-fg-subtle',
                )}
              >
                {step.state === 'done' ? <CheckIcon strokeWidth={2.5} aria-hidden /> : null}
                {step.state === 'blocked' ? <CircleAlertIcon aria-hidden /> : null}
                {step.state === 'pending' ? <MinusIcon aria-hidden /> : null}
              </span>
              {i < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn('mx-1.5 h-0.5 flex-1 rounded-pill', step.state === 'done' ? 'bg-success' : 'bg-border')}
                />
              ) : null}
            </span>
            <span className="flex flex-col gap-0.5 pr-3">
              <span className="text-[13.5px] font-medium text-fg">{step.label}</span>
              {step.detail ? <span className="text-xs leading-[1.4] text-pretty text-fg-muted">{step.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
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
export type { MergeStep, MergeStepState };
