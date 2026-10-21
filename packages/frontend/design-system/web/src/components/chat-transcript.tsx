'use client';

import { AlertCircleIcon, CheckIcon, LayersIcon } from 'lucide-react';
import type * as React from 'react';

import { FoldChevron } from '../internal/fold';
import { cn } from '../lib/utils';

/**
 * The agent chat's transcript (Chat Components, Transcript): a 46rem column
 * where the person's turns are cards on the right and the agent's are
 * unboxed prose on the left, each agent turn opened by a `TurnHeader`.
 *
 * - `ChatTranscript`: the column; turns 20px apart.
 * - `ChatUserMessage`: the person's turn, a bubble at 80% of the column with
 *   the 28px radius at 15px, its line breaks kept (Bots); attachments sit
 *   above it, the time and its actions (copy, edit) under it, on hover.
 * - `ChatAttachment`: a file on a turn, a 44px card with the type's glyph
 *   on a 32px tile, the name over its size in mono; `icon` alone is the
 *   preview tile.
 * - `ChatMention`: an `@file` in a turn, mono on the selected wash in the
 *   link blue; its `token` form names a skill or an agent.
 * - `TurnHeader`: how a turn went, on a hairline that runs to the edge.
 * - `ChatReply`: the agent's answer, `Prose` at the chat's measure.
 * - `MessageTrail`: under a settled reply, its actions and the tokens it
 *   took, in mono.
 * - `StreamingCaret`: the write head while a reply streams in.
 */
function ChatTranscript({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="chat-transcript"
      className={cn('mx-auto flex w-full max-w-190 flex-col gap-5', className)}
      {...props}
    />
  );
}

function ChatUserMessage({
  time,
  actions,
  attachments,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  /** "09:12", in mono under the card. */
  time?: React.ReactNode;
  /** Icon buttons (copy, edit), shown on hover. */
  actions?: React.ReactNode;
  /** `ChatAttachment`s or `ChatImage`s, above the card; with no children, the message is these alone. */
  attachments?: React.ReactNode;
}) {
  return (
    <div data-slot="chat-user-message" className={cn('group/turn flex flex-col items-end gap-1 pt-2', className)} {...props}>
      {attachments ? <div className="mb-0.5 flex flex-wrap justify-end gap-1.5">{attachments}</div> : null}
      {children != null && children !== false ? (
        <div className="max-w-[80%] rounded-xl bg-card px-5 py-3 text-[15px] leading-[1.55] tracking-[-0.011em] whitespace-pre-wrap wrap-anywhere text-pretty text-fg">
          {children}
        </div>
      ) : null}
      {time || actions ? (
        <div className="flex items-center gap-0.5 text-fg-subtle opacity-0 transition-opacity duration-fast group-hover/turn:opacity-100 group-focus-within/turn:opacity-100">
          {time ? <span className="figures pr-1 font-mono text-[11px]">{time}</span> : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function ChatAttachment({
  icon,
  name,
  meta,
  className,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  icon: React.ReactNode;
  /** Left out, the attachment is its tile alone (a preview, an eye). */
  name?: React.ReactNode;
  /** "48 KB", "212 lines". */
  meta?: React.ReactNode;
}) {
  if (!name) {
    return (
      <span
        data-slot="chat-attachment"
        className={cn(
          'flex size-11 items-center justify-center rounded-md bg-hover-surface text-fg-subtle [&_svg]:size-3.75',
          className,
        )}
        {...props}
      >
        {icon}
      </span>
    );
  }
  return (
    <span
      data-slot="chat-attachment"
      className={cn('inline-flex h-11 items-center gap-2 rounded-md bg-card pr-3 pl-1.5 text-[13px] text-fg', className)}
      {...props}
    >
      <span className="flex size-8 items-center justify-center rounded-sm bg-hover-surface text-fg-muted [&_svg]:size-3.75">
        {icon}
      </span>
      <span className="flex flex-col gap-px">
        <span>{name}</span>
        {meta ? <span className="figures font-mono text-[11px] text-fg-subtle">{meta}</span> : null}
      </span>
    </span>
  );
}

/**
 * `file` (default) is an `@file`, mono in the link blue on the selected
 * wash; `token` is a skill or an agent named in the composer, its glyph and
 * name in ink on the hover wash.
 */
function ChatMention({
  variant = 'file',
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<'span'> & { variant?: 'file' | 'token'; icon?: React.ReactNode }) {
  return (
    <span
      data-slot="chat-mention"
      data-variant={variant}
      className={cn(
        'inline-flex items-center gap-1 rounded-xs px-1.5 text-[13px] [&_svg]:size-3.25',
        variant === 'file' ? 'bg-selected-surface font-mono text-link' : 'bg-hover-surface text-fg',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

type TurnState = 'working' | 'done' | 'stopped' | 'interrupted' | 'resumed';

type TurnHeaderLabels = {
  working: string;
  worked: string;
  stopped: string;
  interrupted: string;
};

const TURN_LABELS: TurnHeaderLabels = {
  working: 'Working',
  worked: 'Worked',
  stopped: 'Stopped',
  interrupted: 'Interrupted',
};

/**
 * TurnHeader — opens each agent turn, at 13px muted with a hairline after it
 * to the column's edge, so the boundary between turns is the rule.
 *
 * - `working`: "Working 12s", breathing.
 * - `done`: "Worked 1m 13s · <model> · 09:14 ✓"; with `onToggle` the whole
 *   line folds the turn's work, its chevron turning.
 * - `stopped`: the person stopped it, a small square after the word.
 * - `interrupted`: it ended without settling, the amber alert after it.
 * - `resumed`: background work came back; `children` say what.
 */
function TurnHeader({
  state,
  elapsed,
  model,
  time,
  open,
  onToggle,
  labels,
  className,
  children,
}: {
  state: TurnState;
  /** "1m 13s", in mono. */
  elapsed?: React.ReactNode;
  model?: React.ReactNode;
  time?: React.ReactNode;
  /** Whether the turn's work is shown; with `onToggle`. */
  open?: boolean;
  onToggle?: () => void;
  labels?: Partial<TurnHeaderLabels>;
  className?: string;
  /** The `resumed` line's words ("Resumed: 2 background tasks finished"). */
  children?: React.ReactNode;
}) {
  const label = { ...TURN_LABELS, ...labels };
  const mono = (value: React.ReactNode) => <span className="figures font-mono text-[12px]">{value}</span>;
  const dot = <span aria-hidden>·</span>;
  const body =
    state === 'working' ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="motion-safe:animate-shimmer">{label.working}</span>
        {elapsed ? mono(elapsed) : null}
      </span>
    ) : state === 'resumed' ? (
      <>
        <LayersIcon className="size-3.25" aria-hidden />
        <span>
          {children}
          {elapsed ? (
            <>
              {' · '}
              {mono(elapsed)}
            </>
          ) : null}
        </span>
      </>
    ) : (
      <>
        {onToggle ? <FoldChevron open={open} /> : null}
        <span>
          {label.worked} {elapsed ? mono(elapsed) : null}
        </span>
        {state === 'stopped' ? (
          <>
            {dot}
            <span>{label.stopped}</span>
            <span aria-hidden className="size-2 rounded-[2px] bg-fg-muted" />
          </>
        ) : null}
        {state === 'interrupted' ? (
          <>
            {dot}
            <span>{label.interrupted}</span>
            <AlertCircleIcon className="size-3.25 text-warning" aria-hidden />
          </>
        ) : null}
        {state === 'done' && model ? (
          <>
            {dot}
            <span className="inline-flex items-center rounded-xs bg-card px-1.5 py-px text-fg">{model}</span>
          </>
        ) : null}
        {state === 'done' && time ? (
          <>
            {dot}
            {mono(time)}
          </>
        ) : null}
        {state === 'done' ? <CheckIcon className="size-3.25 text-success" aria-hidden /> : null}
      </>
    );
  const classes = cn(
    'flex w-full items-center gap-2 text-left text-[13px] text-fg-muted',
    'after:h-px after:flex-1 after:bg-border-subtle after:content-[""]',
    className,
  );
  if (onToggle && state !== 'working' && state !== 'resumed') {
    return (
      <button
        type="button"
        data-slot="turn-header"
        data-state={state}
        aria-expanded={open}
        onClick={onToggle}
        className={cn(classes, 'rounded-xs outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-ring')}
      >
        {body}
      </button>
    );
  }
  return (
    <div data-slot="turn-header" data-state={state} className={classes}>
      {body}
    </div>
  );
}

/**
 * The agent's answer, unboxed: markdown at 15px on 1.6 across the chat's
 * column, its blocks 12px apart. Pass the rendered markdown as children; it
 * styles the elements the way `Prose` does at a chat's scale: headings a step
 * or two over the text, lists with muted markers, links in the link blue,
 * a quote behind a 2px rule, inline code on the card, and tables full width
 * on hairlines, each scrolling sideways in its own box when it is wider
 * than the column. A fenced block is a `ChatCodeBlock` the renderer draws.
 */
function ChatReply({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="chat-reply"
      className={cn(
        'flex min-w-0 flex-col gap-3 text-[15px] leading-[1.6] tracking-[-0.011em] text-pretty wrap-anywhere text-fg',
        // Headings
        '[&_:is(h1,h2,h3,h4,h5,h6)]:m-0 [&_:is(h1,h2,h3,h4,h5,h6)]:mt-1.5 [&_:is(h1,h2,h3,h4,h5,h6)]:font-semibold [&_:is(h1,h2,h3,h4,h5,h6)]:tracking-[-0.014em]',
        '[&_h1]:text-[20px] [&_h2]:text-[18px] [&_h3]:text-[17px] [&_:is(h4,h5,h6)]:text-[15px]',
        // Text, lists, quotes, rules
        '[&_p]:m-0 [&_strong]:font-semibold [&_b]:font-semibold [&_em]:italic',
        '[&_:is(ul,ol)]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1.5 [&_li:first-child]:mt-0 [&_li]:ps-0.5 [&_li]:marker:text-fg-subtle',
        '[&_li_:is(ul,ol)]:mt-1.5 [&_li>p+p]:mt-2',
        '[&_[data-task-list]]:pl-0.5 [&_[data-task-list]>li]:flex [&_[data-task-list]>li]:list-none [&_[data-task-list]>li]:items-baseline [&_[data-task-list]>li]:gap-2 [&_[data-task-list]_input]:m-0 [&_[data-task-list]_input]:accent-primary',
        '[&_blockquote]:m-0 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3.5 [&_blockquote]:text-fg-muted',
        '[&_hr]:my-1 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border-subtle',
        '[&_a]:text-link [&_a]:underline-offset-2 [&_a:hover]:underline',
        '[&_img]:block [&_img]:h-auto [&_img]:max-h-[min(60vh,32rem)] [&_img]:max-w-full [&_img]:rounded-sm',
        '[&_summary]:cursor-pointer [&_summary]:font-medium',
        // Inline code, on the card (a fenced block is a `ChatCodeBlock`)
        '[&_:not(pre)>code]:rounded-xs [&_:not(pre)>code]:bg-card [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.86em]',
        // Tables
        '[&_table]:w-full [&_table]:border-separate [&_table]:border-spacing-0 [&_table]:text-[13.5px] [&_table]:leading-normal [&_table]:tabular-nums',
        '[&_th]:border-b [&_th]:border-border-strong [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-start [&_th]:font-semibold',
        '[&_td]:border-b [&_td]:border-border-subtle [&_td]:px-2 [&_td]:py-2 [&_td]:align-top [&_tbody_tr:last-child_td]:border-b-0',
        '[&_:is(th,td):first-child]:ps-0 [&_:is(th,td):last-child]:pe-0',
        className,
      )}
      {...props}
    />
  );
}

function MessageTrail({
  actions,
  meta,
  className,
}: {
  /** Icon buttons: copy, fork from here, retry. */
  actions?: React.ReactNode;
  /** "3.1k tokens · 09:14". */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="message-trail" className={cn('-ml-1.5 flex items-center gap-0.5 text-fg-subtle', className)}>
      {actions}
      {meta ? <span className="figures ml-1.5 font-mono text-[11px]">{meta}</span> : null}
    </div>
  );
}

function StreamingCaret({ className }: { className?: string }) {
  return (
    <span
      data-slot="streaming-caret"
      aria-hidden
      className={cn('ml-0.5 inline-block h-[1.05em] w-0.5 bg-fg align-[-2px] motion-safe:animate-caret', className)}
    />
  );
}

export { ChatAttachment, ChatMention, ChatReply, ChatTranscript, ChatUserMessage, MessageTrail, StreamingCaret, TurnHeader };
export type { TurnHeaderLabels, TurnState };
