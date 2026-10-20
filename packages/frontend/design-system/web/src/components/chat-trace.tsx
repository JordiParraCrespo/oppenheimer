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
 * - `TraceGroup`: several steps a bot ran together, folded into one quiet
 *   line ("Used 5 tools", "1 failed" in red after it); open, its
 *   `TraceGroupRow`s sit in a bordered card between hairlines.
 * - `TraceGroupRow`: a step in that card, a full-width 40px row with no
 *   glyph, so the verb leads; otherwise a `TraceStep`.
 * - `TraceStep`: one step, 34px: the 16px glyph, its title (truncated)
 *   with its `target` after it in full ink, a mono meta ("14 results", "2
 *   failed"), and, when it has children, the chevron that opens them. `tone="danger"` sets the line in red (a
 *   failed command). Open, its children hang under the title. `action` is
 *   a control at the end of the line (Open session), outside the fold's
 *   trigger, so using it never opens the step.
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

function TraceGroup({
  summary,
  failed,
  defaultOpen = false,
  className,
  children,
}: {
  /** "Used 5 tools", "Searched the web 3 times". */
  summary: React.ReactNode;
  /** "1 failed", in red after the summary. */
  failed?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** The `TraceGroupRow`s. */
  children: React.ReactNode;
}) {
  return (
    <Fold data-slot="trace-group" defaultOpen={defaultOpen} className={cn('flex flex-col', className)}>
      <FoldTrigger className="-ml-2 inline-flex min-h-8.5 max-w-full items-center gap-1.5 self-start rounded-sm px-2 text-[15px] tracking-[-0.011em] text-fg-muted transition-colors duration-instant hover:text-fg [&>svg:last-child]:size-3.75">
        <span className="min-w-0 truncate">{summary}</span>
        {failed ? <span className="figures shrink-0 font-mono text-[12px] text-danger">{failed}</span> : null}
      </FoldTrigger>
      <FoldPanel
        role="list"
        className="mt-1 mb-1 flex flex-col divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle"
      >
        {children}
      </FoldPanel>
    </Fold>
  );
}

/** What a step says and how it opens; `TraceStep` and `TraceGroupRow` take the same. */
type TraceStepProps = {
  /** The verb: "Searched", "Failed to run", "Get pull request". */
  title: React.ReactNode;
  /** What the step was pointed at, after the verb in full ink: "abortSignal", "pnpm test". */
  target?: React.ReactNode;
  /** "14 results", "2 failed", a `DiffStat`; in mono. */
  meta?: React.ReactNode;
  /** `danger`: the step failed, its line in red. */
  tone?: 'default' | 'danger';
  defaultOpen?: boolean;
  /** A small control after the line (a ghost `xs` Button); never inside the trigger. */
  action?: React.ReactNode;
  className?: string;
  /** What it returned (`TraceOutput`, `TraceNote`); present, the line opens to it. */
  children?: React.ReactNode;
};

/** Where a step sits: the classes of its line, its trigger, its action row and its panel. */
type StepChrome = { line: string; trigger: string; actionRow: string; panel: string };

const LINE_CHROME: StepChrome = {
  line: '-ml-2 inline-flex min-h-8.5 max-w-full items-center gap-2.5 self-start rounded-sm px-2 text-[15px] tracking-[-0.011em] text-fg-muted data-[tone=danger]:text-danger',
  trigger: '',
  actionRow: '',
  panel: 'pl-6.5',
};

const ROW_CHROME: StepChrome = {
  line: 'flex min-h-10 w-full min-w-0 items-center gap-2.5 px-3.5 text-[14px] tracking-[-0.006em] text-fg-muted data-[tone=danger]:text-danger',
  trigger: 'rounded-none hover:bg-hover-surface focus-visible:ring-inset',
  actionRow: 'pr-2',
  panel: 'px-3.5',
};

/** One step's line and fold, in the chrome of where it sits. */
function StepBody({
  chrome,
  icon,
  title,
  target,
  meta,
  tone = 'default',
  defaultOpen = false,
  action,
  className,
  children,
}: TraceStepProps & { chrome: StepChrome; icon?: React.ReactNode }) {
  const line = (
    <>
      {icon ? (
        <span aria-hidden className="flex shrink-0 [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 truncate">
        {title}
        {target ? <span className={tone === 'danger' ? undefined : 'text-fg'}> {target}</span> : null}
      </span>
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
  const withAction = (head: React.ReactNode) =>
    action ? (
      <div className={cn('flex max-w-full items-center gap-1', chrome.actionRow)}>
        {head}
        <span className="flex shrink-0">{action}</span>
      </div>
    ) : (
      head
    );
  if (!children) {
    return (
      <div data-slot="trace-step" role="listitem" data-tone={tone} className={cn('flex flex-col', className)}>
        {withAction(
          <div data-tone={tone} className={chrome.line}>
            {line}
          </div>,
        )}
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
      {withAction(
        <FoldTrigger
          data-tone={tone}
          className={cn(
            chrome.line,
            chrome.trigger,
            'transition-colors duration-instant data-[tone=danger]:hover:text-danger [&>svg:last-child]:size-3.75',
          )}
        >
          {line}
        </FoldTrigger>,
      )}
      <FoldPanel className={chrome.panel}>{children}</FoldPanel>
    </Fold>
  );
}

function TraceStep({
  icon,
  ...props
}: TraceStepProps & {
  /** The step's glyph, drawn at 16px. */
  icon: React.ReactNode;
}) {
  return <StepBody chrome={LINE_CHROME} icon={icon} {...props} />;
}

function TraceGroupRow(props: TraceStepProps) {
  return <StepBody chrome={ROW_CHROME} {...props} />;
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

export { Trace, TraceGroup, TraceGroupRow, TraceLive, TraceNote, TraceOutput, TraceStep };
export type { TraceOutputLabels };
