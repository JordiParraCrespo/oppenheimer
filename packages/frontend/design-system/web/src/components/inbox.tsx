// uncatalogued: the Inbox screen's own parts; no other screen draws them
'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import { ClockIcon } from 'lucide-react';
import type * as React from 'react';

import { META_GIVES_WAY, ROW_BUTTON_WITH_ACTION, SidebarRow } from '../internal/sidebar-row';
import { cn } from '../lib/utils';
import { Skeleton } from './skeleton';
import { variedWidth } from '../internal/varied-width';

/**
 * The Inbox (`product/versions/mvp/design/version1/Inbox.dc.html`), laid out
 * as a mail client inside Plan: a list column of what needs you, one row per
 * item, and a reading pane with the item in hand as a message, its answers
 * under it and a toolbar over it.
 */
function InboxList({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="inbox-list" role="list" className={cn('flex flex-col', className)} {...props} />;
}

/**
 * InboxListHead — the list column's 48px head: `leading` (the sidebar
 * toggle), the Inbox's name, the unread count in mono, and `children` (the
 * filter) on the right.
 */
function InboxListHead({
  title,
  count,
  leading,
  className,
  children,
}: {
  title: React.ReactNode;
  /** "3 unread"; nothing when all is read. */
  count?: React.ReactNode;
  leading?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="inbox-list-head"
      className={cn(
        'flex h-12 shrink-0 items-center gap-2 border-b border-border-subtle pr-2.5 pl-3.5',
        className,
      )}
    >
      {leading}
      <h1 className="text-[15px] font-semibold tracking-[-0.011em]">{title}</h1>
      {count ? <span className="figures text-[12px] text-fg-subtle">{count}</span> : null}
      <div className="ml-auto flex items-center gap-1">{children}</div>
    </div>
  );
}

/** When a row's checkbox shows: on hover, on focus within, or while the list is selecting. */
const SELECT_SHOWN =
  'group-hover/row:opacity-100 group-focus-within/row:opacity-100 group-data-selecting/row:opacity-100';
/** The unread dot gives way to the checkbox wherever it shows. */
const SELECT_TAKES_DOT =
  'group-hover/row:invisible group-focus-within/row:invisible group-data-selecting/row:invisible';

/**
 * InboxSelectionHead — the list column's head while rows are selected, in the
 * place of `InboxListHead`: `leading` (the select-all checkbox), how many are
 * selected, and `children` (what can be done to all of them) on the right.
 */
function InboxSelectionHead({
  count,
  leading,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  /** "3 selected". */
  count: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <div
      role="toolbar"
      data-slot="inbox-selection-head"
      className={cn(
        'flex h-12 shrink-0 items-center gap-2.5 border-b border-border-subtle bg-selected-surface pr-2.5 pl-[13px]',
        className,
      )}
      {...props}
    >
      {leading}
      <span className="figures text-[13px] font-medium">{count}</span>
      <div className="ml-auto flex items-center gap-0.5">{children}</div>
    </div>
  );
}

/** The row's box, shared by `InboxItem` and its skeleton so the two cannot drift. */
const ITEM_FRAME =
  'grid w-full grid-cols-[8px_minmax(0,1fr)_auto] gap-x-2.5 gap-y-[3px] border-b border-border-subtle py-3 pr-3.5 pl-2.5';

/**
 * InboxItem — one thing that needs you, as a mail row: an unread dot, who it
 * is from with its mono age (or "Low") on the right, the subject under it and
 * a line of its body. Unread rows set the sender and subject in semibold. The
 * item in the reading pane is `active`, on the selected wash; a `done` row
 * (Show done) is struck through at half strength. `action` is the row's
 * ellipsis, shown on hover, focus or while open, over the age. `select` is its
 * checkbox (a `Checkbox`), in the dot's place on hover or focus, and
 * on every row while the list is `selecting`; a `selected` row takes the
 * selected wash.
 */
function InboxItem({
  sender,
  title,
  preview,
  meta,
  unread,
  active,
  done,
  action,
  menuOpen,
  select,
  selected,
  selecting,
  className,
  render,
  nativeButton,
  ...props
}: Omit<ButtonPrimitive.Props, 'children'> & {
  sender: React.ReactNode;
  /** The subject: the short line of what it asks. */
  title: string;
  /** The first line of its body. */
  preview?: React.ReactNode;
  /** The age ("6m"), or "Low" for a deprioritized item. */
  meta?: React.ReactNode;
  unread?: boolean;
  active?: boolean;
  done?: boolean;
  /** The row's ellipsis: a `DropdownMenu` trigger. */
  action?: React.ReactNode;
  /** Keeps the row lit and the action visible while its menu is open. */
  menuOpen?: boolean;
  /** The row's checkbox, a small `Checkbox`, over the unread dot. */
  select?: React.ReactNode;
  selected?: boolean;
  /** Something in the list is selected: every row shows its checkbox. */
  selecting?: boolean;
}) {
  const withAction = action !== undefined || select !== undefined;
  const button = (
    <ButtonPrimitive
      data-slot="inbox-item"
      data-active={active || undefined}
      data-done={done || undefined}
      data-unread={unread || undefined}
      data-selected={selected || undefined}
      role={withAction ? undefined : 'listitem'}
      aria-current={active ? 'true' : undefined}
      render={render}
      nativeButton={nativeButton ?? render === undefined}
      className={cn(
        ITEM_FRAME,
        'group/inbox items-baseline text-left text-fg outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring data-active:bg-selected-surface data-selected:bg-selected-surface data-done:opacity-50',
        withAction && ROW_BUTTON_WITH_ACTION,
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'col-start-1 row-start-1 size-[7px] self-center rounded-pill group-data-unread/inbox:bg-primary',
          select !== undefined && SELECT_TAKES_DOT,
        )}
      />
      <span className="col-start-2 row-start-1 truncate text-[13.5px] group-data-unread/inbox:font-semibold">
        {sender}
      </span>
      {meta ? (
        <span
          className={cn(
            'figures col-start-3 row-start-1 text-[11px] text-fg-subtle',
            withAction && META_GIVES_WAY,
          )}
        >
          {meta}
        </span>
      ) : null}
      <span className="col-span-2 col-start-2 row-start-2 truncate text-[13.5px] group-data-done/inbox:line-through group-data-unread/inbox:font-semibold">
        {title}
      </span>
      {preview ? (
        <span className="col-span-2 col-start-2 row-start-3 truncate text-[12.5px] text-fg-subtle">
          {preview}
        </span>
      ) : null}
    </ButtonPrimitive>
  );

  if (!withAction) return button;
  return (
    <SidebarRow
      slot="inbox-row"
      action={action}
      menuOpen={menuOpen}
      data-selecting={selecting || undefined}
      className="[&>span:last-child]:top-2.5 [&>span:last-child]:right-2 [&>span:last-child]:translate-y-0"
    >
      {button}
      {select !== undefined ? (
        <span
          className={cn(
            'absolute top-[13px] left-[5px] flex opacity-0 transition-opacity duration-fast',
            SELECT_SHOWN,
          )}
        >
          {select}
        </span>
      ) : null}
    </SidebarRow>
  );
}

const SKELETON_SENDERS = ['w-28', 'w-36', 'w-24', 'w-32'] as const;
const SKELETON_TITLES = ['w-3/4', 'w-2/3', 'w-4/5', 'w-1/2'] as const;
const SKELETON_PREVIEWS = ['w-2/3', 'w-5/6', 'w-1/2', 'w-3/4'] as const;

/**
 * An `InboxItem` while the Inbox loads: the same frame, the sender, its age,
 * the subject and the preview each a bar in a box of its line's height
 * (13.5px and 12.5px type at the body's leading). `index` varies the widths
 * so a list of them does not read as stripes.
 */
function InboxItemSkeleton({ index = 0, className }: { index?: number; className?: string }) {
  return (
    <div
      data-slot="inbox-item-skeleton"
      aria-hidden
      className={cn(ITEM_FRAME, 'items-center', className)}
    >
      <span className="col-start-2 row-start-1 flex h-5 items-center">
        <Skeleton shape="sm" className={cn('h-3 max-w-full', variedWidth(index, SKELETON_SENDERS))} />
      </span>
      <span className="col-start-3 row-start-1 flex h-5 items-center">
        <Skeleton shape="sm" className="h-2.5 w-5" />
      </span>
      <span className="col-span-2 col-start-2 row-start-2 flex h-5 items-center">
        <Skeleton shape="sm" className={cn('h-3', variedWidth(index, SKELETON_TITLES))} />
      </span>
      <span className="col-span-2 col-start-2 row-start-3 flex h-4.5 items-center">
        <Skeleton shape="sm" className={cn('h-2.5', variedWidth(index, SKELETON_PREVIEWS))} />
      </span>
    </div>
  );
}

/**
 * InboxSnoozedRow — a snoozed item under the list's Snoozed head: a clock,
 * its short line with when it comes back under it, and `action` (Bring back).
 */
function InboxSnoozedRow({
  title,
  until,
  action,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  title: string;
  /** When it comes back, in words ("in 1h", "Tomorrow"). */
  until: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="listitem"
      data-slot="inbox-snoozed-row"
      className={cn(
        'flex items-center gap-2.5 rounded-nav px-2.5 py-2 text-fg-muted [&_svg]:size-3.5 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      <ClockIcon aria-hidden className="text-fg-subtle" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-operate">{title}</span>
        <span className="truncate text-xs text-fg-subtle">{until}</span>
      </span>
      {action}
    </div>
  );
}

/**
 * InboxToolbar — the reading pane's 48px head: `children` (Mark as done,
 * Snooze, Deprioritize, Delete as quiet icon buttons, and a Back on a phone),
 * and the item's place in the list (`position`, "1 of 5") in mono on the
 * right.
 */
function InboxToolbar({
  position,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  /** "1 of 5". */
  position?: React.ReactNode;
}) {
  return (
    <div
      role="toolbar"
      data-slot="inbox-toolbar"
      className={cn(
        'flex h-12 shrink-0 items-center gap-0.5 border-b border-border-subtle px-4',
        className,
      )}
      {...props}
    >
      {children}
      {position ? (
        <span className="figures ml-auto text-[12px] text-fg-subtle">{position}</span>
      ) : null}
    </div>
  );
}

/**
 * InboxMessage — the item in hand, read as a message: its question as the
 * heading, then who it is from on a round glyph with where it comes from
 * under the name and how long ago on the right, over a hairline; then what
 * the caller composes under it (`InboxMessageBody`, `InboxMessageFacts`, the
 * answers, `InboxMessageActions`). At the reading measure, centred.
 */
function InboxMessage({
  icon,
  sender,
  meta,
  title,
  age,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'article'>, 'title'> & {
  icon: React.ReactNode;
  sender: React.ReactNode;
  /** Its projects and source: "XRP Mobile · acme/app". */
  meta?: React.ReactNode;
  title: React.ReactNode;
  /** "6m ago". */
  age?: React.ReactNode;
}) {
  return (
    <article
      data-slot="inbox-message"
      className={cn(
        'mx-auto box-border flex w-full max-w-[760px] flex-col gap-5 px-8 pt-7 pb-12 motion-safe:animate-appear max-sm:px-4',
        className,
      )}
      {...props}
    >
      <h2 className="text-[21px] leading-[1.3] font-semibold tracking-[-0.016em] text-pretty">
        {title}
      </h2>
      <div className="flex items-center gap-3 border-b border-border-subtle pb-5">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-control text-fg [&_svg]:size-4"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[14px] font-medium">{sender}</span>
          {meta ? <span className="truncate text-[12.5px] text-fg-muted">{meta}</span> : null}
        </div>
        {age ? <span className="figures shrink-0 text-[12px] text-fg-subtle">{age}</span> : null}
      </div>
      {children}
    </article>
  );
}

function InboxMessageBody({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="inbox-message-body"
      className={cn('text-[15px] leading-[1.6] text-fg text-pretty', className)}
      {...props}
    />
  );
}

/** The facts under the question: a pull request's checks and size, a run's failure line. */
function InboxMessageFacts({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="inbox-message-facts"
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-fg-muted', className)}
      {...props}
    />
  );
}

/**
 * The answer row: `leading` (Later, a link to the thing) on the left, the
 * answers (`children`) on the right, the primary last.
 */
function InboxMessageActions({
  leading,
  children,
  className,
}: {
  leading?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="inbox-message-actions" className={cn('flex flex-wrap items-center gap-2', className)}>
      {leading ? <div className="flex flex-wrap items-center gap-2">{leading}</div> : null}
      {/* The answers keep together, on the right, and wrap as one under the rest. */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

/**
 * InboxMessageChoices — the answers a session waits on, in the card's body, in
 * the order the agent offers them (the frame's "A session is waiting on a
 * decision"): one `Button` each, the first the primary. The row wraps; a
 * label too long for the card is cut, with the whole of it on the button's
 * own `title`.
 */
function InboxMessageChoices({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="group"
      data-slot="inbox-message-choices"
      className={cn('flex min-w-0 flex-wrap gap-1.5 [&>*]:max-w-full', className)}
      {...props}
    />
  );
}

/** InboxQuestions — a session's questions on the card, numbered, one under the other. */
function InboxQuestions({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol data-slot="inbox-questions" className={cn('flex flex-col gap-3.5', className)} {...props} />
  );
}

/**
 * InboxQuestion — one numbered question (the frame's "Three questions before
 * …"): its number in mono, the agent's short tag for it (`header`, "Scope")
 * and the question; under it what the caller composes, the
 * `InboxQuestionOptions` and a field for an answer of the person's own.
 */
function InboxQuestion({
  n,
  header,
  question,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'li'>, 'title'> & {
  n: number;
  header?: React.ReactNode;
  question: React.ReactNode;
}) {
  return (
    <li data-slot="inbox-question" className={cn('flex flex-col gap-2', className)} {...props}>
      <span className="text-[14px] leading-[1.45] text-pretty">
        <span className="figures mr-2 font-mono text-[12px] text-fg-subtle">{n}</span>
        {header ? (
          <span className="mr-2 inline-flex h-4.5 items-center rounded-xs bg-hover-surface px-1.5 align-text-bottom font-mono text-[11px] text-fg-muted">
            {header}
          </span>
        ) : null}
        {question}
      </span>
      {children}
    </li>
  );
}

type InboxQuestionOptionsProps = Omit<
  ToggleGroupPrimitive.Props,
  'value' | 'defaultValue' | 'onValueChange' | 'multiple'
> & {
  /** Several may be picked; without it, one at a time. */
  multiple?: boolean;
  /** The picks, by option index. */
  value: readonly number[];
  onValueChange: (value: number[]) => void;
};

/**
 * InboxQuestionOptions — a question's options as pills: one pick, or several
 * when `multiple`. Pressing the picked one of a single choice keeps it.
 */
function InboxQuestionOptions({
  multiple = false,
  value,
  onValueChange,
  className,
  ...props
}: InboxQuestionOptionsProps) {
  return (
    <ToggleGroupPrimitive
      data-slot="inbox-question-options"
      multiple={multiple}
      value={value.map(String)}
      onValueChange={(next) => {
        const picked = next.filter((v): v is string => typeof v === 'string').map(Number);
        if (multiple) return onValueChange([...picked].sort((a, b) => a - b));
        const one = picked.find((v) => !value.includes(v));
        if (one !== undefined) onValueChange([one]);
      }}
      className={cn('flex flex-wrap gap-1.5', className)}
      {...props}
    />
  );
}

/**
 * InboxQuestionOption — one option, a 32px pill on a hairline (the frame's
 * `qs` pills); picked, it takes the selected wash and a primary ring. Its
 * `description` sits under the label in subtle ink, and the pill rounds to a
 * card around the two.
 */
function InboxQuestionOption({
  index,
  label,
  description,
  className,
  ...props
}: Omit<TogglePrimitive.Props, 'value' | 'children'> & {
  index: number;
  label: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <TogglePrimitive
      data-slot="inbox-question-option"
      value={String(index)}
      className={cn(
        'flex min-h-8 max-w-full flex-col items-start justify-center gap-0.5 border border-border px-3.5 py-1.5 text-left text-[13px] text-fg outline-none transition-[background-color,border-color,transform] duration-instant ease-standard select-none hover:bg-hover-surface active:scale-[0.975] focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-disabled:opacity-40 data-pressed:border-primary data-pressed:bg-selected-surface',
        description ? 'rounded-md' : 'rounded-pill',
        className,
      )}
      {...props}
    >
      <span className="leading-[1.35]">{label}</span>
      {description ? (
        <span className="text-[12px] leading-[1.35] text-fg-subtle">{description}</span>
      ) : null}
    </TogglePrimitive>
  );
}

/** InboxClear — nothing needs you: a heading, and what is still going on, in the reading pane. */
function InboxClear({
  title,
  children,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="inbox-clear"
      className={cn(
        'flex max-w-[420px] flex-1 flex-col justify-center gap-1.5 px-10 motion-safe:animate-appear max-sm:px-4',
        className,
      )}
    >
      <span className="text-[21px] font-semibold tracking-[-0.016em]">{title}</span>
      {children ? <span className="text-[14px] leading-normal text-fg-muted">{children}</span> : null}
    </div>
  );
}

export {
  InboxClear,
  InboxItem,
  InboxItemSkeleton,
  InboxList,
  InboxListHead,
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
  InboxMessageChoices,
  InboxMessageFacts,
  InboxQuestion,
  InboxQuestionOption,
  InboxQuestionOptions,
  InboxQuestions,
  InboxSelectionHead,
  InboxSnoozedRow,
  InboxToolbar,
};
