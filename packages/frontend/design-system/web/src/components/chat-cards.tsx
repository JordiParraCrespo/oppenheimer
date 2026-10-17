'use client';

import { ArrowRightIcon, CheckIcon, ChevronDownIcon, ExternalLinkIcon, FileTextIcon, HelpCircleIcon, LoaderIcon } from 'lucide-react';
import * as React from 'react';

import { Fold, FoldPanel, FoldTrigger } from '../internal/fold';
import { cn } from '../lib/utils';
import { Badge } from './badge';
import { Button } from './button';
import { DiffStat } from './diff-stat';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu';
import { IconButton } from './icon-button';

/**
 * The cards a turn leaves in the transcript (Chat Components, Cards):
 * what it changed, what it proposes, who it launched, what it asked, and
 * the objects it made or was given, what it said to another bot, and the
 * instructions it proposes for itself.
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
  return (
    <Fold data-slot="subagent-run-card" defaultOpen={defaultOpen} className={cn('flex flex-col text-[13.5px]', className)}>
      <div className="flex min-h-7 items-center gap-2">
        {live ? <LoaderIcon aria-hidden className="size-3.5 text-success motion-safe:animate-spin" /> : null}
        <FoldTrigger className="flex items-center gap-1.5 text-fg-muted">{summary}</FoldTrigger>
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
      <FoldPanel className="ml-5 flex flex-col">{children}</FoldPanel>
    </Fold>
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

/* ── Bot to bot ──────────────────────────────────────────────────────────── */

/**
 * BotExchange — what one bot said to another, in the transcript: a hairline
 * card at 13.5px, one `BotExchangeTurn` per message. The first turn is the
 * message (out: "Sent to **Plan Bot**", in: "From **Quota Bot**", with its
 * time in mono); the answer under it is a `BotExchangeTurn reply`, on the
 * hover wash under a hairline. The arrow points the way the words went.
 *
 * ```tsx
 * <BotExchange>
 *   <BotExchangeTurn direction="out" time="10:42" lead={<>Sent to <strong>Plan Bot</strong></>}>…</BotExchangeTurn>
 *   <BotExchangeTurn direction="in" reply lead="Plan Bot replied">…</BotExchangeTurn>
 * </BotExchange>
 * ```
 */
function BotExchange({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="bot-exchange"
      className={cn('flex flex-col overflow-hidden rounded-md border border-border-subtle text-[13.5px]', className)}
      {...props}
    />
  );
}

function BotExchangeTurn({
  direction,
  reply = false,
  lead,
  time,
  className,
  children,
}: {
  /** `out`: this bot wrote it; `in`: the other one did. */
  direction: 'out' | 'in';
  /** The answer under the message: on the hover wash, under a hairline. */
  reply?: boolean;
  /** Who and which way, in muted ink; the bot's name in a `strong` takes full ink. */
  lead: React.ReactNode;
  time?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="bot-exchange-turn"
      data-direction={direction}
      data-reply={reply || undefined}
      className={cn(
        'group/turn flex items-start gap-2.5 px-3 py-2.5 data-reply:border-t data-reply:border-border-subtle data-reply:bg-hover-surface',
        className,
      )}
    >
      <ArrowRightIcon aria-hidden className="mt-0.75 size-3.5 shrink-0 text-fg-muted group-data-[direction=in]/turn:rotate-180" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 text-fg-muted [&_strong]:font-medium [&_strong]:text-fg">{lead}</span>
          {time ? <span className="figures shrink-0 font-mono text-[11px] text-fg-subtle">{time}</span> : null}
        </span>
        <span className="leading-normal text-pretty text-fg">{children}</span>
      </span>
    </div>
  );
}

/* ── Proposed instructions ───────────────────────────────────────────────── */

/**
 * ProposedFile — a file a bot proposes for itself (its INSTRUCTIONS.md), on
 * an 18px card: the file's glyph and mono name, a "Proposed by" pill, the
 * added lines in green mono, then what can be done about it. While it waits
 * that is `actions`: quiet `ProposedFileAction`s (Review in settings,
 * Reject) and the caller's Accept. Once decided it is `outcome`, in muted
 * words ("Accepted"), and the proposal fades back. The proposal follows
 * under a hairline, one `ProposedFileLine` each, the added ones in green.
 */
function ProposedFile({
  file,
  by,
  additions,
  actions,
  outcome,
  className,
  children,
}: {
  file: React.ReactNode;
  /** The pill: "Proposed by Plan Bot". */
  by?: React.ReactNode;
  additions?: number;
  /** While it waits: `ProposedFileAction`s, then the one that accepts. */
  actions?: React.ReactNode;
  /** Once decided: the outcome in words. Present, it replaces `actions`. */
  outcome?: React.ReactNode;
  className?: string;
  /** `ProposedFileLine`s. */
  children: React.ReactNode;
}) {
  const settled = outcome !== undefined && outcome !== null;
  return (
    <div
      data-slot="proposed-file"
      data-settled={settled || undefined}
      className={cn('group/file flex flex-col overflow-hidden rounded-lg bg-card', className)}
    >
      <div className="flex flex-wrap items-center gap-2 py-2.5 pr-2.5 pl-4">
        <FileTextIcon aria-hidden className="size-4 shrink-0 text-fg-muted" />
        <span className="font-mono text-[12.5px] text-fg">{file}</span>
        {by ? (
          <span className="inline-flex h-5 items-center rounded-pill bg-hover-surface px-2 text-[12px] text-fg-muted">{by}</span>
        ) : null}
        {additions !== undefined ? (
          <span className="figures font-mono text-[12px] text-success">+{additions}</span>
        ) : null}
        <span className="flex-1" />
        {settled ? (
          <span role="status" className="flex min-h-7 items-center pr-1.5 text-[12.5px] text-fg-muted">
            {outcome}
          </span>
        ) : actions ? (
          <span className="flex min-h-7 items-center gap-0.5">{actions}</span>
        ) : null}
      </div>
      <pre className="m-0 border-t border-border-subtle px-4 pt-2.5 pb-3.5 font-mono text-[12.5px] leading-[1.65] break-words whitespace-pre-wrap transition-opacity duration-base group-data-settled/file:opacity-55">
        {children}
      </pre>
    </div>
  );
}

/** A quiet choice on a `ProposedFile` (Review in settings, Reject): muted ink, full ink on hover. */
function ProposedFileAction({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="proposed-file-action"
      variant="ghost"
      size="sm"
      className={cn('font-normal text-fg-muted hover:text-fg', className)}
      {...props}
    />
  );
}

function ProposedFileLine({ added = false, children }: { added?: boolean; children?: React.ReactNode }) {
  return (
    <span data-slot="proposed-file-line" data-added={added || undefined} className="block min-h-[1.65em] text-fg data-added:text-success">
      {children}
    </span>
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
  BotExchange,
  BotExchangeTurn,
  ChangedFileRow,
  ChangedFilesCard,
  ContextCard,
  ProposedFile,
  ProposedFileAction,
  ProposedFileLine,
  ProposedPlanCard,
  QuestionsPill,
  SubagentRow,
  SubagentRunCard,
};
export type { ProposedPlanLabels, SubagentState };
