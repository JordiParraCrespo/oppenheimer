'use client';

import { ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * RunHistory — the last thirty days as one column per day. A column's
 * height is its successful runs; a red dot above it means at least one
 * failed that day. Empty days keep a 3px stub so the time axis never
 * compresses. Hovering a column dims the rest. The header carries the
 * title, the range, and either the legend (succeeded and failed in mono)
 * or a link ("65 runs ›") when the counts live elsewhere.
 *
 * Pure markup, no chart library: thirty bars is not a chart.
 */
type RunHistoryDay = {
  /** ISO date or any key. */
  date: string;
  ok: number;
  failed: number;
};

function RunHistory({
  title = 'Run history',
  range = 'Last 30 days',
  days,
  legend = true,
  succeededLabel = 'Succeeded',
  failedLabel = 'Failed',
  link,
  axis,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  title?: React.ReactNode;
  range?: React.ReactNode;
  days: RunHistoryDay[];
  /** Show the succeeded / failed counts on the right. */
  legend?: boolean;
  succeededLabel?: React.ReactNode;
  failedLabel?: React.ReactNode;
  /** Replaces the legend with a link, e.g. "65 runs". */
  link?: { label: React.ReactNode; onClick?: () => void };
  /** The two axis labels, start and end. */
  axis?: [React.ReactNode, React.ReactNode];
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.ok));
  const ok = days.reduce((n, d) => n + d.ok, 0);
  const failed = days.reduce((n, d) => n + d.failed, 0);
  return (
    <div
      data-slot="run-history"
      className={cn('rounded-lg bg-card px-[18px] pt-4 pb-3', className)}
      {...props}
    >
      <div className="flex min-h-5 flex-wrap items-center gap-2 text-[13.5px]">
        <span className="font-semibold text-fg">{title}</span>
        <span className="text-fg-muted">{range}</span>
        <span className="flex-1" />
        {link ? (
          <button
            type="button"
            onClick={link.onClick}
            className="inline-flex items-center gap-1 text-[13px] text-fg-muted transition-colors duration-fast hover:text-fg"
          >
            {link.label}
            <ChevronRightIcon className="size-3.5" aria-hidden />
          </button>
        ) : legend ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
              <span aria-hidden className="size-1.5 rounded-pill bg-success" />
              <span className="figures text-[12.5px] text-fg">{ok}</span>
              {succeededLabel}
            </span>
            <span className="ml-3 inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
              <span aria-hidden className="size-1.5 rounded-pill bg-danger" />
              <span className="figures text-[12.5px] text-fg">{failed}</span>
              {failedLabel}
            </span>
          </>
        ) : null}
      </div>
      <div
        data-slot="run-history-bars"
        data-hover={hover !== null || undefined}
        className="mt-3.5 flex h-[104px] items-end gap-[5px]"
        onMouseLeave={() => setHover(null)}
      >
        {days.map((day, i) => {
          const zero = day.ok === 0;
          return (
            <div
              key={day.date}
              data-slot="run-history-col"
              data-zero={zero || undefined}
              data-on={hover === i || undefined}
              title={`${day.date}: ${day.ok} succeeded, ${day.failed} failed`}
              onMouseEnter={() => setHover(i)}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-[3px]"
              style={{ maxWidth: 16 }}
            >
              {day.failed > 0 ? (
                <span aria-hidden className="size-1.5 shrink-0 rounded-pill bg-danger" />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  'w-full rounded-pill transition-opacity duration-base',
                  zero ? 'bg-border' : 'bg-success',
                  hover !== null && hover !== i && !zero && 'opacity-35',
                )}
                style={{ height: zero ? 3 : `${Math.max(8, (day.ok / max) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      {axis ? (
        <div className="mt-2 flex justify-between text-[11px] text-fg-subtle">
          <span>{axis[0]}</span>
          <span>{axis[1]}</span>
        </div>
      ) : null}
    </div>
  );
}

export { RunHistory };
export type { RunHistoryDay };
