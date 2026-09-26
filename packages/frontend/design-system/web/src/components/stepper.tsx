import { CheckIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Stepper — the provisioning pane. A session is not instant: the host has to
 * be reached, the repo cloned, the branch checked out and the harness started.
 * Steps are named so a slow one is diagnosable instead of just slow.
 *
 * Each step: an 18px mark on a rail (an empty ring while pending, a spinning
 * ring while running, a green check when done), a 14px label that lifts to
 * full ink as it runs, and a mono meta line. The rail between steps turns
 * green as steps complete. The footer carries a mono elapsed time ("1.4s")
 * and a status word ("Working…"). Pending steps are not numbered: the order
 * is the rail's, and a number would read as a count of what is left.
 */
type StepState = 'pending' | 'running' | 'done' | 'failed';

type Step = {
  id: string;
  label: React.ReactNode;
  /** Mono detail under the label ("cloning 41 MB", "1.2s"). */
  meta?: React.ReactNode;
  state: StepState;
};

function Stepper({
  steps,
  elapsed,
  status,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  steps: Step[];
  /** Mono elapsed time in the footer ("00:12"). */
  elapsed?: React.ReactNode;
  status?: React.ReactNode;
}) {
  return (
    <div data-slot="stepper" className={cn('flex flex-col', className)} {...props}>
      <ol className="m-0 flex list-none flex-col p-0">
        {steps.map((step, index) => (
          <li
            key={step.id}
            data-slot="step"
            data-state={step.state}
            className="group/step flex min-h-[46px] gap-3"
          >
            <span className="flex w-[18px] shrink-0 flex-col items-center">
              <span
                aria-hidden
                className={cn(
                  'mt-px flex size-[18px] shrink-0 items-center justify-center rounded-pill border-[1.5px] border-border-strong bg-background text-[10px] leading-none text-fg-subtle transition-colors duration-base',
                  step.state === 'running' &&
                    'border-primary border-t-transparent text-transparent motion-safe:animate-spin',
                  step.state === 'done' && 'border-success bg-success text-white',
                  step.state === 'failed' && 'border-danger bg-danger text-white',
                )}
              >
                {step.state === 'done' ? (
                  <CheckIcon className="size-2.5" strokeWidth={3} />
                ) : step.state === 'failed' ? (
                  '×'
                ) : null}
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    'mt-1 w-[1.5px] flex-1 rounded-[1px] bg-border transition-colors duration-base',
                    step.state === 'done' && 'bg-success',
                  )}
                />
              ) : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px] pb-4">
              <span
                className={cn(
                  'text-operate text-fg-muted transition-colors duration-base',
                  step.state === 'running' && 'font-medium text-fg',
                  step.state === 'done' && 'text-fg',
                  step.state === 'failed' && 'text-danger',
                )}
              >
                {step.label}
              </span>
              {step.meta ? (
                <span className="figures text-[11.5px] text-fg-muted">{step.meta}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      {elapsed || status ? (
        <div className="mt-1 flex items-center gap-2.5 text-[12.5px] text-fg-muted">
          {elapsed ? <span className="figures">{elapsed}</span> : null}
          {status ? <span>{status}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export { Stepper };
export type { Step, StepState };
