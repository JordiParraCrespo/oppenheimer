import { CheckIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * RoutineSteps — the routine editor as four numbered steps down a rail:
 * Where, When, What, Agent. Each step is a 24px mono number on the hover
 * wash, a title with a one-line subtitle, and its fields underneath. A
 * finished step inverts its number to a tick in full ink and prints a
 * one-line summary on the right, so the whole routine reads top to bottom
 * before you save. The rail between steps darkens once the step above is
 * done.
 */
function RoutineSteps({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="routine-steps"
      className={cn('m-0 flex list-none flex-col p-0', className)}
      {...props}
    />
  );
}

function RoutineStep({
  number,
  title,
  subtitle,
  done,
  summary,
  note,
  last,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'li'>, 'title'> & {
  number: number;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  done?: boolean;
  /** One line on the right once done ("XRP Mobile · optimus"). */
  summary?: React.ReactNode;
  /** A muted line under the fields. */
  note?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li
      data-slot="routine-step"
      data-done={done || undefined}
      data-last={last || undefined}
      className={cn('grid grid-cols-[24px_minmax(0,1fr)] gap-x-3.5', className)}
      {...props}
    >
      <span className="flex flex-col items-center">
        <span
          aria-hidden
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-pill transition-colors duration-slow ease-standard',
            done ? 'bg-fg text-card' : 'figures bg-hover-surface text-[11.5px] font-medium text-fg-muted',
          )}
        >
          {done ? <CheckIcon className="size-3" strokeWidth={2.5} /> : number}
        </span>
        {last ? null : (
          <span
            aria-hidden
            className={cn(
              'my-1.5 w-px flex-1 transition-colors duration-slow ease-standard',
              done ? 'bg-fg-subtle' : 'bg-border-subtle',
            )}
          />
        )}
      </span>
      <div className={cn('min-w-0', last ? 'pb-1' : 'pb-[26px]')}>
        <div className="flex min-h-6 flex-wrap items-baseline gap-2">
          <span className="text-[15px] leading-6 font-semibold tracking-[-0.011em] text-fg">{title}</span>
          {subtitle ? <span className="text-[13px] text-fg-subtle">{subtitle}</span> : null}
          {done && summary ? (
            <span className="ml-auto max-w-[260px] truncate text-[12.5px] text-fg-muted motion-safe:animate-label-in">
              {summary}
            </span>
          ) : null}
        </div>
        {children ? <div className="mt-2.5 flex flex-col gap-3">{children}</div> : null}
        {note ? <p className="m-0 mt-2 text-[12.5px] leading-[1.5] text-pretty text-fg-subtle">{note}</p> : null}
      </div>
    </li>
  );
}

/** Up to three fields side by side inside a step; one column under 520px. */
function RoutineStepFields({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="routine-step-fields"
      className={cn('grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3', className)}
      {...props}
    />
  );
}

export { RoutineStep, RoutineStepFields, RoutineSteps };
