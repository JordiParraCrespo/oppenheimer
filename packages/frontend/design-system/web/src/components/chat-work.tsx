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
 * A bot's chat draws its work as a trace instead: `chat-trace.tsx`.
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

export { ReasoningRow, ToolCallGroup, ToolCallLive, ToolCallRow };
