'use client';

import { CheckIcon, ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon, FileTextIcon, HelpCircleIcon, LoaderIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Badge } from './badge';
import { Button } from './button';
import { DiffStat } from './diff-stat';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu';
import { IconButton } from './icon-button';

/**
 * The cards a turn leaves in the transcript (Chat Components, Cards):
 * what it changed, what it proposes, who it launched, what it asked, and
 * the objects it made or was given.
 */

/* ── Changed files ───────────────────────────────────────────────────────── */

/**
 * ChangedFilesCard — closes a turn that edited files: "3 files changed"
 * and the total `DiffStat` on the card, its actions (Review, Undo) on the
 * right, then one `ChangedFileRow` per file under a hairline.
 */
function ChangedFilesCard({
  title,
  additions,
  deletions,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  additions: number;
  deletions: number;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-slot="changed-files-card" className={cn('overflow-hidden rounded-lg bg-card', className)}>
      <div className="flex items-center gap-2 py-2.5 pr-2.5 pl-3.5">
        <span className="text-[13.5px] font-medium text-fg">{title}</span>
        <DiffStat additions={additions} deletions={deletions} className="text-[12px]" />
        <span className="flex-1" />
        {actions}
      </div>
      <div className="flex flex-col divide-y divide-border-subtle border-t border-border-subtle">{children}</div>
    </div>
  );
}

/** One file: the row opens its diff, the trailing button opens it in an editor. */
function ChangedFileRow({
  path,
  additions,
  deletions,
  icon,
  onOpen,
  onOpenInEditor,
  openInEditorLabel = 'Open in editor',
  className,
}: {
  path: string;
  additions: number;
  deletions: number;
  icon?: React.ReactNode;
  onOpen?: () => void;
  onOpenInEditor?: () => void;
  openInEditorLabel?: string;
  className?: string;
}) {
  return (
    <div
      data-slot="changed-file-row"
      className={cn('flex min-h-9 items-center gap-2 pr-1.5 pl-3.5 transition-colors duration-instant hover:bg-hover-surface', className)}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden className="flex text-fg-muted [&_svg]:size-3.5">
          {icon ?? <FileTextIcon />}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg">{path}</span>
        <DiffStat additions={additions} deletions={deletions} className="text-[12px]" />
      </button>
      {onOpenInEditor ? (
        <IconButton size="sm" aria-label={openInEditorLabel} onClick={onOpenInEditor}>
          <ExternalLinkIcon />
        </IconButton>
      ) : null}
    </div>
  );
}

/* ── Proposed plan ───────────────────────────────────────────────────────── */

type ProposedPlanLabels = {
  badge: string;
  more: string;
  less: string;
  refine: string;
  implement: string;
  implementOptions: string;
};

const PLAN_LABELS: ProposedPlanLabels = {
  badge: 'Plan',
  more: 'Show full plan',
  less: 'Show less',
  refine: 'Refine',
  implement: 'Implement',
  implementOptions: 'Implement options',
};

/**
 * ProposedPlanCard — what plan mode hands back: on the 28px hero card, a
 * Plan pill and the title with the plan's own actions (copy, download), the
 * steps at 15px, then the foot: the fold toggle for a long plan, Refine,
 * and Implement, the turn's one primary action, split with its options
 * (`implementMenu`) when there are any. A plan past ten lines folds there
 * (`collapsible`).
 */
function ProposedPlanCard({
  title,
  actions,
  collapsible = false,
  onRefine,
  onImplement,
  implementMenu,
  labels,
  className,
  children,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  collapsible?: boolean;
  onRefine?: () => void;
  onImplement?: () => void;
  /** `DropdownMenuItem`s for Implement's chevron. */
  implementMenu?: React.ReactNode;
  labels?: Partial<ProposedPlanLabels>;
  className?: string;
  /** The plan, as rendered markdown (an `ol`). */
  children: React.ReactNode;
}) {
  const label = { ...PLAN_LABELS, ...labels };
  const [open, setOpen] = React.useState(false);
  return (
    <div data-slot="proposed-plan-card" className={cn('flex flex-col gap-3.5 rounded-xl bg-card p-5', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="soft">{label.badge}</Badge>
        <span className="min-w-0 flex-1 text-[15px] font-medium text-fg">{title}</span>
        {actions}
      </div>
      <div
        className={cn(
          'text-[15px] leading-[1.55] text-fg [&_li]:mt-1.5 [&_li:first-child]:mt-0 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_code]:rounded-xs [&_code]:bg-hover-surface [&_code]:px-1.25 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.86em]',
          collapsible && !open && 'max-h-[15.5em] overflow-hidden mask-b-from-70%',
        )}
      >
        {children}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {collapsible ? (
          <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
            {open ? label.less : label.more}
          </Button>
        ) : null}
        <span className="flex-1" />
        {onRefine ? (
          <Button variant="secondary" onClick={onRefine}>
            {label.refine}
          </Button>
        ) : null}
        {onImplement ? (
          <span className="flex">
            <Button onClick={onImplement} className={cn(implementMenu && 'rounded-r-none pr-3.5')}>
              {label.implement}
            </Button>
            {implementMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={label.implementOptions}
                  className="flex size-(--control-h-md) items-center justify-center rounded-r-pill border-l border-white/20 bg-primary text-primary-foreground outline-none transition-colors duration-fast hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <ChevronDownIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">{implementMenu}</DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ── Subagent run ────────────────────────────────────────────────────────── */

/**
 * SubagentRunCard — where a turn launched subagents, unboxed: a 28px line
 * with the spinner while any runs, the summary ("3 subagents · 1 running ·
 * 1 failed · 48s") folding the rows, and Stop all on the right while any
 * runs. Open, one `SubagentRow` each, indented.
 */
function SubagentRunCard({
  summary,
  live = false,
  onStopAll,
  stopAllLabel = 'Stop all',
  defaultOpen = true,
  className,
  children,
}: {
  /** The summary's parts, already joined by the caller ("3 subagents · …"). */
  summary: React.ReactNode;
  live?: boolean;
  onStopAll?: () => void;
  stopAllLabel?: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div data-slot="subagent-run-card" className={cn('flex flex-col text-[13.5px]', className)}>
      <div className="flex min-h-7 items-center gap-2">
        {live ? <LoaderIcon aria-hidden className="size-3.5 text-success motion-safe:animate-spin" /> : null}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-xs text-left text-fg-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
        >
          {summary}
          <ChevronRightIcon
            aria-hidden
            className={cn('size-3.25 text-fg-subtle transition-transform duration-fast ease-standard', open && 'rotate-90')}
          />
        </button>
        <span className="flex-1" />
        {live && onStopAll ? (
          <button
            type="button"
            onClick={onStopAll}
            className="inline-flex h-6 items-center gap-1.5 rounded-pill px-2.5 text-[12.5px] text-fg-muted outline-none transition-colors duration-fast hover:bg-hover-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden className="size-1.75 rounded-[2px] bg-current" />
            {stopAllLabel}
          </button>
        ) : null}
      </div>
      {open ? <div className="ml-5 flex flex-col">{children}</div> : null}
    </div>
  );
}

type SubagentState = 'running' | 'completed' | 'failed';

/**
 * One subagent, 30px: its name, role and model in subtle ink, then its
 * state (a spinner and Running, a check and Completed, Failed in red), the
 * elapsed time in mono, and what it is doing now (`activity`, mono) or how
 * it ended (`outcome`, "→ 38 tests pass"). `note` trails in subtle ink
 * ("launched 2 subagents"); `actions` (Stop, Message) show on hover.
 */
function SubagentRow({
  name,
  role,
  model,
  state,
  stateLabel,
  elapsed,
  activity,
  outcome,
  note,
  actions,
  className,
}: {
  name: React.ReactNode;
  role?: React.ReactNode;
  model?: React.ReactNode;
  state: SubagentState;
  /** The state's word; English by default. */
  stateLabel?: React.ReactNode;
  elapsed?: React.ReactNode;
  activity?: React.ReactNode;
  outcome?: React.ReactNode;
  note?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const word = stateLabel ?? { running: 'Running', completed: 'Completed', failed: 'Failed' }[state];
  return (
    <div
      data-slot="subagent-row"
      data-state={state}
      className={cn('group/sub flex min-h-7.5 items-center gap-2 rounded-sm px-1.5 transition-colors duration-instant hover:bg-hover-surface', className)}
    >
      <span className="font-medium text-fg">{name}</span>
      {role ? <span className="text-[12.5px] text-fg-subtle">{role}</span> : null}
      {model ? <span className="text-[12.5px] text-fg-subtle">{model}</span> : null}
      {state === 'running' ? <LoaderIcon aria-hidden className="size-3.25 text-success motion-safe:animate-spin" /> : null}
      {state === 'completed' ? <CheckIcon aria-hidden className="size-3.25 text-fg-muted" /> : null}
      <span className={cn('text-[12.5px]', state === 'failed' ? 'text-danger' : 'text-fg-muted')}>{word}</span>
      {state === 'running' ? (
        <>
          {activity ? <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-muted">{activity}</span> : <span className="flex-1" />}
          {elapsed ? <span className="figures font-mono text-[11.5px] text-fg-subtle">{elapsed}</span> : null}
        </>
      ) : (
        <>
          {elapsed ? <span className="figures font-mono text-[11.5px] text-fg-subtle">{elapsed}</span> : null}
          {outcome ? <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-muted">→ {outcome}</span> : <span className="flex-1" />}
        </>
      )}
      {note ? <span className="shrink-0 text-[12px] text-fg-subtle">{note}</span> : null}
      {actions ? (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-fast group-hover/sub:opacity-100 group-focus-within/sub:opacity-100">
          {actions}
        </span>
      ) : null}
    </div>
  );
}

/* ── Questions ───────────────────────────────────────────────────────────── */

/**
 * QuestionsPill — questions the agent asked without stopping, folded into a
 * 28px hairline pill ("2 questions"); `answered` adds the check and the
 * word. With `onClick` it opens them.
 */
function QuestionsPill({
  answered,
  answeredLabel = 'Answered',
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'button'>, 'type'> & { answered?: boolean; answeredLabel?: string }) {
  return (
    <button
      type="button"
      data-slot="questions-pill"
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-pill border border-border px-3 text-[13px] text-fg-muted outline-none transition-colors duration-fast hover:bg-hover-surface focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.25',
        className,
      )}
      {...props}
    >
      <HelpCircleIcon aria-hidden />
      {children}
      {answered ? (
        <>
          <CheckIcon aria-hidden />
          {answeredLabel}
        </>
      ) : null}
    </button>
  );
}

/** The record of answered questions: each question at medium weight over its answer. */
function AnsweredQuestions({
  items,
  className,
}: {
  items: readonly { question: React.ReactNode; answer: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl data-slot="answered-questions" className={cn('m-0 flex flex-col gap-3 rounded-lg border border-border-subtle p-3.5 text-[14px] leading-[1.45]', className)}>
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed record, in the order it was asked.
        <div key={i}>
          <dt className="font-medium text-fg">{item.question}</dt>
          <dd className="m-0 text-fg-muted">{item.answer}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Context cards ───────────────────────────────────────────────────────── */

/**
 * ContextCard — an object the agent created or was handed (a pull request,
 * an automation, a thread), one row on the card that opens it: the object's
 * glyph (green for an open pull request: `tone="success"`), the title at
 * 14px medium over a 12.5px muted line, and the one action (Open, View).
 */
function ContextCard({
  icon,
  tone = 'muted',
  title,
  meta,
  action,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  icon: React.ReactNode;
  tone?: 'muted' | 'success';
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div data-slot="context-card" className={cn('flex items-center gap-3 rounded-lg bg-card px-3.5 py-3', className)} {...props}>
      <span aria-hidden className={cn('flex shrink-0 [&_svg]:size-4', tone === 'success' ? 'text-success' : 'text-fg-muted')}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[14px] font-medium text-fg">{title}</span>
        {meta ? <span className="truncate text-[12.5px] text-fg-muted">{meta}</span> : null}
      </span>
      {action}
    </div>
  );
}

export {
  AnsweredQuestions,
  ChangedFileRow,
  ChangedFilesCard,
  ContextCard,
  ProposedPlanCard,
  QuestionsPill,
  SubagentRow,
  SubagentRunCard,
};
export type { ProposedPlanLabels, SubagentState };
