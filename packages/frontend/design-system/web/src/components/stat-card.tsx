import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * The numbers a page leads with.
 *
 * - `StatCard`: a label, the figure in 24px mono (`value`, with a smaller
 *   `unit` or word beside it: "4 in 2 folders", "214 / 214 Passing"), a
 *   line under it (`detail`, or a `StatDelta` for "+9% from 139"), and an
 *   optional 6px `StatBar`. A `Card` in all but name: 18px, the hairline.
 * - `StatBar`: shares as rounded segments with 3px between them (additions
 *   against deletions, files per folder), or one share of a track
 *   (`track`: checks passed of all).
 * - `StatDelta`: a change against the period before, green when it is the
 *   good direction and red when not — the caller says which, since a wait
 *   going down is good and a count going down may not be.
 * - `FactTile` / `FactGrid`: a small label over a value on the hover wash,
 *   in a grid of 220px or more ("What changes · Mostly runner/"); `dot`
 *   leads the label with a run-state colour, `mono` sets the value in mono.
 */

type StatTone = 'success' | 'danger' | 'warning' | 'primary' | 'teal' | 'muted';

const TONE_BG: Record<StatTone, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  primary: 'bg-chart-1',
  teal: 'bg-chart-2',
  muted: 'bg-fg-subtle',
};

function StatCard({
  label,
  value,
  unit,
  detail,
  bar,
  icon,
  variant = 'card',
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  /** `inset` sits inside a `Panel`: the hover wash, no hairline. */
  variant?: 'card' | 'inset';
  label: React.ReactNode;
  /** The figure; a node, so `+612` can be green and carry its `−248`. */
  value: React.ReactNode;
  /** Words or a second figure beside it, smaller and muted unless toned. */
  unit?: React.ReactNode;
  /** The line under it: words, or a `StatDelta`. */
  detail?: React.ReactNode;
  /** A `StatBar`. */
  bar?: React.ReactNode;
  /** A round state glyph in place of a figure (Conflicts: None). */
  icon?: React.ReactNode;
}) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        'flex min-w-0 flex-col gap-2.5 px-4.5 py-4',
        variant === 'card' ? 'rounded-lg border border-border-subtle bg-card' : 'rounded-md bg-hover-surface',
        className,
      )}
      {...props}
    >
      <span className="text-sm text-fg-muted">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {icon}
        <span className={cn(icon ? 'text-base font-medium' : 'figures text-[24px] leading-[1.15] font-medium tracking-[-0.015em]', 'text-fg')}>
          {value}
        </span>
        {unit ? <span className="text-sm whitespace-nowrap text-fg-muted">{unit}</span> : null}
      </span>
      {detail ? <span className="text-xs text-fg-muted">{detail}</span> : null}
      {bar}
    </div>
  );
}

function StatBar({
  segments,
  track = false,
  className,
}: {
  /** Shares in percent; with `track`, the first is drawn over a 100% track. */
  segments: readonly { share: number; tone: StatTone; label?: string }[];
  track?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="stat-bar"
      aria-hidden
      className={cn('flex h-1.5 gap-[3px]', track && 'overflow-hidden rounded-pill bg-hover-surface', className)}
    >
      {segments.map((segment, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional.
          key={i}
          title={segment.label}
          className={cn(
            'h-full min-w-1 rounded-pill transition-[width] duration-slow ease-out',
            TONE_BG[segment.tone],
            !track && i === segments.length - 1 && 'flex-1',
          )}
          // biome-ignore lint/style/noInlineStyles: the share is data.
          style={track || i < segments.length - 1 ? { width: `${segment.share}%` } : undefined}
        />
      ))}
    </div>
  );
}

function StatDelta({
  value,
  tone,
  className,
  children,
}: {
  /** "+9%", "−16%". */
  value: React.ReactNode;
  tone: 'good' | 'bad' | 'flat';
  className?: string;
  /** What it is against: "from 139". */
  children?: React.ReactNode;
}) {
  return (
    <span data-slot="stat-delta" className={cn('inline-flex flex-wrap items-baseline gap-1.5 text-xs text-fg-muted', className)}>
      <span className={cn('figures', tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : 'text-fg-muted')}>
        {value}
      </span>
      {children}
    </span>
  );
}

function FactGrid({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="fact-grid"
      className={cn('m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5 p-0', className)}
      {...props}
    />
  );
}

function FactTile({
  label,
  dot,
  mono = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'li'>, 'children'> & {
  label: React.ReactNode;
  /** A tone for the dot before the label (a prep step that passed, failed, runs). */
  dot?: StatTone;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li data-slot="fact-tile" className={cn('flex min-w-0 flex-col gap-1 rounded-md bg-hover-surface px-3.5 py-3', className)} {...props}>
      <span className="flex items-center gap-1.5 text-xs text-fg-muted">
        {dot ? <span aria-hidden className={cn('size-1.5 shrink-0 rounded-pill', TONE_BG[dot])} /> : null}
        {label}
      </span>
      <span className={cn('text-[13.5px] leading-[1.45] text-pretty text-fg', mono && 'figures truncate text-sm')}>{children}</span>
    </li>
  );
}

export { FactGrid, FactTile, StatBar, StatCard, StatDelta };
export type { StatTone };
