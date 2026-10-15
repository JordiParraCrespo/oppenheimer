'use client';

import { CpuIcon, LoaderIcon, SlidersHorizontalIcon } from 'lucide-react';
import type * as React from 'react';

import { Fold, FoldPanel, FoldTrigger } from '../internal/fold';
import { cn } from '../lib/utils';

/**
 * What the agent did in a turn (Chat Components, Work and tools), all at
 * 13.5px in muted ink so it never reads as the answer.
 *
 * - `ToolCallGroup`: a settled run of calls folded into one verb summary
 *   ("Read 3 files, searched 2 patterns, ran 2 commands, 1 failed", the
 *   failure in red via `failed`); open, its `ToolCallRow`s hang from a
 *   hairline.
 * - `ToolCallRow`: one call, 28px: the glyph, the verb, the target in mono
 *   in full ink, then a mono meta (a line range, "14 results", "exit 1"
 *   in red with `tone="danger"`, a `DiffStat`). `output` makes the row a
 *   fold over the call's output on the terminal ground.
 * - `ToolCallLive`: the call in flight, in place of the summary: a spinner,
 *   the verb and target breathing, the elapsed time.
 * - `ReasoningRow`: "Thought for 9s", folded; open, the thinking reads in
 *   the muted tone behind a hairline.
 *
 * A bot's chat draws its work as a trace instead (Bots, AI Elements): a
 * line per step at the reply's own 15px, in muted ink, that opens to what
 * the step returned.
 *
 * - `Trace`: the steps of one run of work, a list.
 * - `TraceStep`: one step, 34px: the 16px glyph, its title (truncated), a
 *   mono meta ("14 results", "2 failed"), and, when it has children, the
 *   chevron that opens them. `tone="danger"` sets the line in red (a
 *   failed command). Open, its children hang under the title.
 * - `TraceOutput`: what a step returned, on the card at the 14px radius:
 *   mono 12.5px lines, numbered, scrolling past 256px.
 * - `TraceNote`: a step's words (the thinking, a plan), muted at 14px.
 * - `TraceLive`: the run in flight, after the last step: a spinner, what it
 *   is doing now breathing ("Searching abortSignal", "Writing"), the
 *   elapsed time in mono.
 */
function ToolCallGroup({
  summary,
  failed,
  icon,
  defaultOpen = false,
  className,
  children,
}: {
  summary: React.ReactNode;
  /** "1 failed", in red after the summary. */
  failed?: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** The `ToolCallRow`s. */
  children: React.ReactNode;
}) {
  return (
    <Fold
      data-slot="tool-call-group"
      defaultOpen={defaultOpen}
      className={cn('flex flex-col text-[13.5px] text-fg-muted', className)}
    >
      <FoldTrigger className="inline-flex items-center gap-1.75 self-start py-0.5">
        <span aria-hidden className="flex w-4 justify-center [&_svg]:size-3.5">
          {icon ?? <SlidersHorizontalIcon />}
        </span>
        <span>
          {summary}
          {failed ? (
            <>
              {', '}
              <span className="text-danger">{failed}</span>
            </>
          ) : null}
        </span>
      </FoldTrigger>
      <FoldPanel className="ml-1.75 flex flex-col border-l border-border-subtle pt-1 pb-0.5 pl-1.75">{children}</FoldPanel>
    </Fold>
  );
}

function ToolCallRow({
  icon,
  verb,
  target,
  meta,
  tone = 'default',
  output,
  className,
}: {
  icon: React.ReactNode;
  verb: React.ReactNode;
  target?: React.ReactNode;
  meta?: React.ReactNode;
  /** `danger` sets the meta in red (a non-zero exit). */
  tone?: 'default' | 'danger';
  /** The call's output; present, the row folds over it. */
  output?: React.ReactNode;
  className?: string;
}) {
  const line = (
    <>
      <span aria-hidden className="flex text-fg-subtle [&_svg]:size-3.5">
        {icon}
      </span>
      <span>{verb}</span>
      {target ? <span className="min-w-0 truncate font-mono text-[12px] text-fg">{target}</span> : null}
      {meta ? (
        <span className={cn('figures flex shrink-0 gap-1.5 font-mono text-[11.5px]', tone === 'danger' ? 'text-danger' : 'text-fg-subtle')}>
          {meta}
        </span>
      ) : null}
    </>
  );
  if (!output) {
    return (
      <div data-slot="tool-call-row" className={cn('flex min-h-7 items-center gap-2.25 pl-2', className)}>
        {line}
      </div>
    );
  }
  return (
    <Fold data-slot="tool-call-row" className={cn('flex flex-col pl-2', className)}>
      <FoldTrigger className="flex min-h-7 items-center gap-2.25">{line}</FoldTrigger>
      <FoldPanel
        render={<pre />}
        className="mt-0.5 mb-2 ml-5.5 overflow-x-auto rounded-sm bg-term-bg px-3 py-2.5 font-mono text-[12px] leading-[1.55] text-term-fg"
      >
        {output}
      </FoldPanel>
    </Fold>
  );
}

function ToolCallLive({
  verb,
  target,
  elapsed,
  className,
}: {
  verb: React.ReactNode;
  target?: React.ReactNode;
  elapsed?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="tool-call-live"
      role="status"
      className={cn('inline-flex items-center gap-1.75 text-[13.5px] text-fg-muted', className)}
    >
      <span aria-hidden className="flex w-4 justify-center">
        <LoaderIcon className="size-3.5 motion-safe:animate-spin" />
      </span>
      <span className="motion-safe:animate-shimmer">
        {verb} {target ? <span className="font-mono text-[12px] text-fg">{target}</span> : null}
      </span>
      {elapsed ? <span className="figures font-mono text-[11.5px] text-fg-subtle">{elapsed}</span> : null}
    </div>
  );
}

function ReasoningRow({
  label,
  defaultOpen = false,
  className,
  children,
}: {
  /** "Thought for 9s". */
  label: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** The thinking, as text. */
  children: React.ReactNode;
}) {
  return (
    <Fold
      data-slot="reasoning-row"
      defaultOpen={defaultOpen}
      className={cn('flex flex-col gap-2 text-[13.5px] text-fg-muted', className)}
    >
      <FoldTrigger className="inline-flex items-center gap-1.75 self-start">
        <span aria-hidden className="flex w-4 justify-center">
          <CpuIcon className="size-3.5" />
        </span>
        {label}
      </FoldTrigger>
      <FoldPanel render={<p />} className="m-0 ml-5.75 border-l border-border-subtle pl-3 leading-[1.55] text-pretty">
        {children}
      </FoldPanel>
    </Fold>
  );
}

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

function TraceOutput({ className, children }: { className?: string; children: string }) {
  const lines = children.replace(/\n$/, '').split('\n');
  return (
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

export { ReasoningRow, ToolCallGroup, ToolCallLive, ToolCallRow, Trace, TraceLive, TraceNote, TraceOutput, TraceStep };
