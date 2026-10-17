'use client';

import { LoaderIcon } from 'lucide-react';
import * as React from 'react';

import { Fold, FoldPanel, FoldTrigger } from '../internal/fold';
import { cn } from '../lib/utils';

/**
 * A bot's chat draws its work as a trace (Bots, AI Elements), not as the
 * agent's tool-call groups in `chat-work`: a line per step at the reply's
 * own 15px, in muted ink, that opens to what the step returned.
 *
 * - `Trace`: the steps of one run of work, a list.
 * - `TraceStep`: one step, 34px: the 16px glyph, its title (truncated), a
 *   mono meta ("14 results", "2 failed"), and, when it has children, the
 *   chevron that opens them. `tone="danger"` sets the line in red (a
 *   failed command). Open, its children hang under the title.
 * - `TraceOutput`: what a step returned, on the card at the 14px radius:
 *   mono 12.5px lines, numbered, scrolling past 256px. `maxLines` cuts a
 *   long one with "Show N more lines" under it; `0` keeps it behind "Show
 *   raw output", for a step whose summary is drawn above it.
 * - `TraceNote`: a step's words (the thinking, a plan), muted at 14px.
 * - `TraceLive`: the run in flight, after the last step: a spinner, what it
 *   is doing now breathing ("Searching abortSignal", "Writing"), the
 *   elapsed time in mono.
 */
function Trace({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="trace" role="list" className={cn('flex flex-col', className)} {...props} />;
}

const TRACE_LINE =
  '-ml-2 inline-flex min-h-8.5 max-w-full items-center gap-2.5 self-start rounded-sm px-2 text-[15px] tracking-[-0.011em] text-fg-muted data-[tone=danger]:text-danger';

function TraceStep({
  icon,
  title,
  meta,
  tone = 'default',
  defaultOpen = false,
  className,
  children,
}: {
  /** The step's glyph, drawn at 16px. */
  icon: React.ReactNode;
  /** "Searched abortSignal", "Failed to run pnpm test". */
  title: React.ReactNode;
  /** "14 results", "2 failed", a `DiffStat`; in mono. */
  meta?: React.ReactNode;
  /** `danger`: the step failed, its line in red. */
  tone?: 'default' | 'danger';
  defaultOpen?: boolean;
  className?: string;
  /** What it returned (`TraceOutput`, `TraceNote`); present, the line opens to it. */
  children?: React.ReactNode;
}) {
  const line = (
    <>
      <span aria-hidden className="flex shrink-0 [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 truncate">{title}</span>
      {meta ? (
        <span
          className={cn(
            'figures flex shrink-0 gap-1.5 font-mono text-[12px]',
            tone === 'danger' ? 'text-danger' : 'text-fg-subtle',
          )}
        >
          {meta}
        </span>
      ) : null}
    </>
  );
  if (!children) {
    return (
      <div data-slot="trace-step" role="listitem" data-tone={tone} className={cn('flex flex-col', className)}>
        <div data-tone={tone} className={TRACE_LINE}>
          {line}
        </div>
      </div>
    );
  }
  return (
    <Fold
      data-slot="trace-step"
      role="listitem"
      data-tone={tone}
      defaultOpen={defaultOpen}
      className={cn('flex flex-col', className)}
    >
      <FoldTrigger
        data-tone={tone}
        className={cn(
          TRACE_LINE,
          'transition-colors duration-instant data-[tone=danger]:hover:text-danger [&>svg:last-child]:size-3.75',
        )}
      >
        {line}
      </FoldTrigger>
      <FoldPanel className="pl-6.5">{children}</FoldPanel>
    </Fold>
  );
}

type TraceOutputLabels = {
  /** The button that shows output kept back entirely (`maxLines={0}`). */
  raw: string;
  /** The button under a cut: how many more lines it shows. */
  more: (count: number) => string;
  less: string;
};

const TRACE_OUTPUT_LABELS: TraceOutputLabels = {
  raw: 'Show raw output',
  more: (count) => `Show ${count} more lines`,
  less: 'Show less',
};

function TraceOutput({
  maxLines,
  labels,
  className,
  children,
}: {
  /** Lines drawn before a "Show N more lines" button; 0 keeps the output behind "Show raw output". */
  maxLines?: number;
  labels?: Partial<TraceOutputLabels>;
  className?: string;
  children: string;
}) {
  const label = { ...TRACE_OUTPUT_LABELS, ...labels };
  const [expanded, setExpanded] = React.useState(false);
  const all = children.replace(/\n$/, '').split('\n');
  const cut = maxLines !== undefined && !expanded && all.length > maxLines;
  const lines = cut ? all.slice(0, maxLines) : all;
  const toggle =
    maxLines !== undefined && all.length > maxLines ? (
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="mb-2.5 self-start rounded-xs text-[13px] text-fg-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
      >
        {expanded ? label.less : maxLines === 0 ? label.raw : label.more(all.length - maxLines)}
      </button>
    ) : null;
  if (lines.length === 0) return toggle;
  return (
    <div className="flex flex-col">
      <div data-slot="trace-output" className={cn('mt-0.5 mb-2.5 overflow-hidden rounded-md bg-card', className)}>
        <div className="max-h-64 overflow-auto py-3 font-mono text-[12.5px] leading-[1.65]">
          {lines.map((text, index) => (
            // A step's output never reorders: a line's place is its identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <div key={index} className="flex min-w-max">
              <span aria-hidden className="figures w-10 shrink-0 pr-3.5 text-right text-fg-subtle select-none">
                {index + 1}
              </span>
              <span className="pr-4 whitespace-pre-wrap text-fg">{text}</span>
            </div>
          ))}
        </div>
      </div>
      {toggle}
    </div>
  );
}

function TraceNote({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="trace-note"
      className={cn('mb-2 text-[14px] leading-[1.6] whitespace-pre-wrap text-pretty text-fg-muted', className)}
      {...props}
    />
  );
}

function TraceLive({
  elapsed,
  className,
  children,
}: {
  /** "12s", "00:12", in mono. */
  elapsed?: React.ReactNode;
  className?: string;
  /** What the run is doing now: "Thinking", "Searching abortSignal", "Writing". */
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="trace-live"
      role="status"
      className={cn('flex min-h-8.5 items-center gap-2.5 text-[15px] tracking-[-0.011em] text-fg-muted', className)}
    >
      <LoaderIcon aria-hidden className="size-4 shrink-0 motion-safe:animate-spin" />
      <span className="min-w-0 truncate motion-safe:animate-shimmer">{children}</span>
      {elapsed ? <span className="figures shrink-0 font-mono text-[12px] text-fg-subtle">{elapsed}</span> : null}
    </div>
  );
}

export { Trace, TraceLive, TraceNote, TraceOutput, TraceStep };
export type { TraceOutputLabels };
