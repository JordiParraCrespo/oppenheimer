'use client';

import { AlertCircleIcon, LayersIcon, PlusIcon } from 'lucide-react';
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
 *   the 14px radius at 15px, its line breaks kept (Bots); attachments sit
 *   above it, the time and its actions (copy, edit) under it, on hover.
 * - `ChatAttachment`: a file on a turn, a 44px card with the type's glyph
 *   on a 32px tile, the name over its size in mono; `icon` alone is the
 *   preview tile.
 * - `ChatMention`: an `@file` in a turn, mono on the selected wash in the
 *   link blue; its `token` form names a skill or an agent.
 * - `TurnHeader`: how a turn went ("Worked for 17s ›"), over a hairline
 *   that spans the column.
 * - `ChatReply`: the agent's answer, `Prose` at the chat's measure.
 * - `MessageTrail`: under a settled reply, its actions, then the time it
 *   ended or the tokens it took.
 * - `StreamingCaret`: the write head while a reply streams in.
 * - `ChatReaction`: your reaction to a turn, one emoji on a small pill; on a
 *   `ChatUserMessage` it sits on the bubble's lower edge (`reaction`).
 * - `ChatReactionBar`: the reactions offered in one tap, a pill of emoji
 *   that pop in one after another, the one you gave on a wash, then "+".
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
  reaction,
  tone = 'card',
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
  /**
   * The bubble's fill, chosen by the ground it stands on: `card` lifts off a
   * bot's recessed chat; `wash` (the chat's grey wash, a code block's) is
   * for a chat on a card-coloured ground, a session's, where a card would
   * vanish; `accent` is the selected blue wash.
   */
  tone?: 'card' | 'wash' | 'accent';
  /** A `ChatReaction`, on the bubble's lower edge, the way a reaction sits on a message. */
  reaction?: React.ReactNode;
}) {
  return (
    <div data-slot="chat-user-message" className={cn('group/turn flex flex-col items-end gap-1 pt-2', className)} {...props}>
      {attachments ? <div data-slot="chat-user-message-attachments" className="mb-0.5 flex flex-wrap justify-end gap-1.5">{attachments}</div> : null}
      {children != null && children !== false ? (
        <div
          className={cn(
            'relative max-w-[80%] rounded-md px-4.5 py-2.5 text-[15px] leading-[1.6] tracking-[-0.011em] whitespace-pre-wrap wrap-anywhere text-pretty text-fg',
            tone === 'accent' ? 'bg-selected-surface' : tone === 'wash' ? 'bg-chat-wash' : 'bg-card',
            reaction ? 'mb-3.5' : null,
          )}
        >
          {children}
          {reaction ? (
            <span data-slot="chat-user-message-reaction" className="absolute -bottom-4 left-3 whitespace-normal">
              {reaction}
            </span>
          ) : null}
        </div>
      ) : reaction ? (
        <span data-slot="chat-user-message-reaction" className="-mt-2.5 mr-3 flex justify-end">
          {reaction}
        </span>
      ) : null}
      {time || actions ? (
        <div data-slot="chat-user-message-trail" className="flex items-center gap-0.5 text-fg-subtle opacity-0 transition-opacity duration-fast group-hover/turn:opacity-100 group-focus-within/turn:opacity-100">
          {time ? <span className="figures pr-1 font-mono text-[11px]">{time}</span> : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/**
 * ChatCommand — the `/command` a message starts with (`/ship`, `/usage`),
 * in the link blue with no wash, in a sent message and in the composer as
 * it is written. It adds no padding, so the composer's copy of the text
 * lays out exactly as the textarea's.
 */
function ChatCommand({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="chat-command"
      className={cn('text-link', className)}
      {...props}
    />
  );
}

/**
 * Text that may open on a `/command`: the command marked (`ChatCommand`) and
 * the rest as it is, or the text alone when `command` is not its prefix.
 * What counts as a command is the caller's; the mark is drawn here, for a
 * sent message and for the composer's field alike.
 */
function ChatCommandText({ text, command }: { text: string; command?: string | null }) {
  if (!command || !text.startsWith(command)) return text;
  return (
    <>
      <ChatCommand>{command}</ChatCommand>
      {text.slice(command.length)}
    </>
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
 * TurnHeader — opens each agent turn, at 14px muted over a hairline that
 * spans the column, so the boundary between turns is the rule.
 *
 * - `working`: "Working 12s", breathing.
 * - `done`: "Worked for 1m 13s ›", then `model` and `time` when given; with
 *   `onToggle` the whole line folds the turn's work, its chevron after the
 *   words turning down as it opens.
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
  const figure = (value: React.ReactNode) => <span className="tabular-nums">{value}</span>;
  const dot = <span aria-hidden>·</span>;
  const body =
    state === 'working' ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="motion-safe:animate-shimmer">{label.working}</span>
        {elapsed ? figure(elapsed) : null}
      </span>
    ) : state === 'resumed' ? (
      <>
        <LayersIcon className="size-3.25" aria-hidden />
        <span>
          {children}
          {elapsed ? (
            <>
              {' · '}
              {figure(elapsed)}
            </>
          ) : null}
        </span>
      </>
    ) : (
      <>
        <span>
          {label.worked} {elapsed ? figure(elapsed) : null}
        </span>
        {onToggle ? <FoldChevron open={open} className="-ml-0.5 size-3.5" /> : null}
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
            <span className="inline-flex items-center rounded-xs bg-hover-surface px-1.5 py-px text-fg">{model}</span>
          </>
        ) : null}
        {state === 'done' && time ? (
          <>
            {dot}
            {figure(time)}
          </>
        ) : null}
      </>
    );
  const classes = cn(
    'flex w-full items-center gap-1.5 border-b border-border-subtle pb-2.5 text-left text-[14px] text-fg-muted',
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
        className={cn(classes, 'outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-ring')}
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
 * The agent's answer, unboxed: markdown at 15px on 1.7 across the chat's
 * column, its blocks 14px apart. Pass the rendered markdown as children; it
 * styles the elements the way `Prose` does at a chat's scale: headings a step
 * or two over the text, lists with muted markers, links in the link blue,
 * a quote behind a 2px rule, inline code on the chat's wash, and tables full
 * width as a framed card (a hairline round its 10px corners and between its
 * rows and columns, the header row on the same wash), each scrolling
 * sideways in its own box when it is wider than the column. A fenced block is a `ChatCodeBlock` the renderer draws.
 */
/**
 * How a table reads in the chat: a framed card, its 10px corners on a
 * hairline; the header row on the wash over a hairline, hairlines between
 * rows and columns. One set of rules for a reply's Markdown tables
 * (`ChatReply`) and every other table the chat draws (`ChatTable`), so the two
 * never drift apart.
 */
const CHAT_TABLE_RULES = cn(
  '[&_table]:w-full [&_table]:border-separate [&_table]:border-spacing-0 [&_table]:rounded-sm [&_table]:border [&_table]:border-border-subtle [&_table]:text-[14px] [&_table]:leading-normal [&_table]:tabular-nums',
  '[&_:is(th,td)]:border-border-subtle [&_:is(th,td):not(:last-child)]:border-e [&_:is(th,td)]:px-3 [&_:is(th,td)]:text-start',
  '[&_th]:border-b [&_th]:bg-chat-wash [&_th]:py-2 [&_th]:font-semibold',
  '[&_thead_tr:first-child_th:first-child]:rounded-ss-[9px] [&_thead_tr:first-child_th:last-child]:rounded-se-[9px]',
  '[&_td]:border-b [&_td]:py-2.5 [&_td]:align-top [&_tbody_tr:last-child_td]:border-b-0',
);

/**
 * A table in the chat that is not a reply's Markdown (a visual's table): the
 * `<table>` goes inside, and reads exactly as a reply's tables do, at the
 * chat's 14px, scrolling sideways in its own box when it is wider than the
 * column.
 */
function ChatTable({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="chat-table"
      className={cn('min-w-0 overflow-x-auto text-fg', CHAT_TABLE_RULES, className)}
      {...props}
    />
  );
}

function ChatReply({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="chat-reply"
      className={cn(
        'flex min-w-0 flex-col gap-3.5 text-[15px] leading-[1.7] tracking-[-0.011em] text-pretty wrap-anywhere text-fg',
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
        // Inline code, on the chat's wash (a fenced block is a `ChatCodeBlock`)
        '[&_:not(pre)>code]:rounded-[5px] [&_:not(pre)>code]:bg-chat-wash [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.86em]',
        CHAT_TABLE_RULES,
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
  /** "11:06", "3.1k tokens · 09:14". */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="message-trail" className={cn('-ml-1.5 flex items-center gap-0.5 text-fg-subtle', className)}>
      {actions}
      {meta ? <span className="ml-1.5 text-[12px] tabular-nums">{meta}</span> : null}
    </div>
  );
}

/**
 * Your reaction to a turn: one emoji on a pill with a hairline, lifted off
 * the ground it overlaps. With `onClick` it is a button (taking it back,
 * opening the picker); its `aria-label` says what it does.
 */
function ChatReaction({
  emoji,
  className,
  onClick,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & { emoji: string }) {
  const classes = cn(
    'inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-border-subtle bg-card px-1.5 text-[15px] leading-none shadow-sm motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:fade-in-0 motion-safe:duration-200',
    onClick ? 'cursor-pointer transition-transform duration-fast ease-standard hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring' : null,
    className,
  );
  if (!onClick) {
    return (
      <span data-slot="chat-reaction" className={classes} aria-label={props['aria-label']} title={props.title}>
        {emoji}
      </span>
    );
  }
  return (
    <button data-slot="chat-reaction" type="button" className={classes} onClick={onClick} {...props}>
      {emoji}
    </button>
  );
}

/** What `ChatReactionBar` says to a screen reader. */
type ChatReactionBarLabels = {
  /** "React with 👍". */
  react: (emoji: string) => string;
  /** "Remove reaction 👍", on the one you gave. */
  remove: (emoji: string) => string;
  /** "More emoji", the "+" that opens the whole picker. */
  more: string;
};

/**
 * The reactions offered in one tap: a pill of emoji that pop in one after
 * another and grow under the pointer, the one you gave (`selected`) on the
 * selected wash, so a second tap takes it back; then "+" for the rest
 * (`onMore`). What a tap means is the caller's: `onPick` gets the emoji.
 */
function ChatReactionBar({
  emoji,
  selected,
  onPick,
  onMore,
  labels,
  className,
}: {
  emoji: readonly string[];
  selected?: string | null;
  onPick: (emoji: string) => void;
  onMore?: () => void;
  labels: ChatReactionBarLabels;
  className?: string;
}) {
  return (
    <div
      data-slot="chat-reaction-bar"
      role="group"
      className={cn('flex items-center gap-0.5 rounded-full border border-border-subtle bg-popover p-1 shadow-popover', className)}
    >
      {emoji.map((item, index) => {
        const chosen = item === selected;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={chosen}
            aria-label={chosen ? labels.remove(item) : labels.react(item)}
            title={chosen ? labels.remove(item) : labels.react(item)}
            onClick={() => onPick(item)}
            // The pop-in runs one after another, 25ms apart: a delay no class holds.
            style={{ animationDelay: `${index * 25}ms` }}
            className={cn(
              'flex size-9 items-center justify-center rounded-full text-[22px] leading-none transition-transform duration-fast ease-standard hover:scale-125 focus-visible:outline-2 focus-visible:outline-ring motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:fade-in-0 motion-safe:[animation-fill-mode:both] motion-safe:duration-200',
              chosen ? 'bg-selected-surface' : 'hover:bg-hover-surface',
            )}
          >
            {item}
          </button>
        );
      })}
      {onMore ? (
        <button
          type="button"
          aria-label={labels.more}
          title={labels.more}
          onClick={onMore}
          className="ml-0.5 flex size-9 items-center justify-center rounded-full bg-hover-surface text-fg-muted transition-colors duration-fast hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
        >
          <PlusIcon aria-hidden className="size-4.5" />
        </button>
      ) : null}
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

export { ChatAttachment, ChatCommand, ChatCommandText, ChatMention, ChatReaction, ChatReactionBar, ChatReply, ChatTable, ChatTranscript, ChatUserMessage, MessageTrail, StreamingCaret, TurnHeader };
export type { ChatReactionBarLabels, TurnHeaderLabels, TurnState };
