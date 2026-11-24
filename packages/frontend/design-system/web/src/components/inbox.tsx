// uncatalogued: the Inbox screen's own parts; no other screen draws them
'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import { ClockIcon } from 'lucide-react';
import * as React from 'react';

import { META_GIVES_WAY, ROW_BUTTON_WITH_ACTION, SidebarRow } from '../internal/sidebar-row';
import { cn } from '../lib/utils';
import { EmptyState } from './empty-state';
import { Kbd } from './kbd';
import { Skeleton } from './skeleton';
import { variedWidth } from '../internal/varied-width';

/**
 * The Inbox, a page of its own laid out as a mail client: a list column of
 * what needs you, one row per item, and beside it a deck with the item in
 * hand as a card on the stack of what is left, its answers under it, a
 * toolbar over it and the keys under it.
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

/**
 * When a row's checkbox shows: on hover, on focus within, or while the list is
 * selecting. Hidden, it takes no press, so a tap on a phone (no hover) opens
 * the row rather than checking it; its hit area stops short of the sender.
 */
const SELECT_SHOWN =
  'pointer-events-none group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:opacity-100 group-data-selecting/row:pointer-events-auto group-data-selecting/row:opacity-100 [&_[data-slot=checkbox]]:after:-inset-x-1 [&_[data-slot=checkbox]]:after:-inset-y-1';
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
      <span className="text-[13px] font-medium">{count}</span>
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
  progress,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  /** "1 of 5". */
  position?: React.ReactNode;
  /** How much of this visit's Inbox is handled, 0 to 1: a hairline of primary along the bottom edge. */
  progress?: number;
}) {
  return (
    <div
      role="toolbar"
      data-slot="inbox-toolbar"
      className={cn(
        'relative flex h-12 shrink-0 items-center gap-0.5 border-b border-border-subtle px-4',
        className,
      )}
      {...props}
    >
      {children}
      {position ? (
        <span className="figures ml-auto text-[12px] text-fg-subtle">{position}</span>
      ) : null}
      {progress !== undefined && progress > 0 ? (
        <span
          aria-hidden
          data-slot="inbox-toolbar-progress"
          className="absolute bottom-[-1px] left-0 h-0.5 origin-left bg-primary transition-[width] duration-slow ease-out"
          style={{ width: `${Math.min(1, progress) * 100}%` }}
        />
      ) : null}
    </div>
  );
}

type InboxSwipe = 'left' | 'right';
/** Where the card in hand goes when it is put away: right (done), left (later), up (snoozed). */
type InboxDeckExit = InboxSwipe | 'up';

/** How far a card is dragged before letting go puts it away, in px. */
const SWIPE_AWAY = 96;
/** Movement a press may make before it is read as a drag rather than a tap, in px. */
const SWIPE_SLOP = 8;
/** What a press on which is never a swipe: the card's own controls. */
const SWIPE_IGNORES = 'button,a,input,textarea,select,label,[role=button],[contenteditable=true]';

/**
 * The answers on the card in hand, in reading order: a session's choices, or
 * the answer row's right side (Approve, Merge, Send answers). The deck's
 * number badges count the same set (`globals.css`, `inbox-deck`), so the
 * digit a person presses is the badge they read.
 */
const ANSWERS =
  '[data-slot=inbox-message-choices] > *, [data-slot=inbox-message-actions] > div:last-child > *';

/**
 * The `n`th answer on the deck's card in hand (from 1), or null when there is
 * none or it is disabled. For the caller's number keys.
 */
function inboxDeckAnswer(deck: HTMLElement | null, n: number): HTMLElement | null {
  const answer = deck?.querySelectorAll<HTMLElement>(ANSWERS)[n - 1];
  if (!answer) return null;
  if (answer.matches(':disabled,[aria-disabled=true],[data-disabled]')) return null;
  return answer;
}

/**
 * InboxDeck — the item in hand as a card on the stack of what is left: up to
 * two cards peek out under it (`behind`), so the pile shrinks as it is
 * cleared. On touch, the card follows a sideways drag, tilting as it goes and
 * stamping what letting go will do (`swipeLabels`); past 96px it is put away
 * (`onSwipe`), short of it it settles back. A drag that starts on one of the
 * card's controls, or goes more up than across, is the page's scroll, not a
 * swipe. `leaving` sends the card off that way (right, left or up) over the
 * base duration; the caller swaps in the next item once it has gone. The
 * answers wear their number from 1 where there is a keyboard to press them
 * with (`inboxDeckAnswer`).
 */
function InboxDeck({
  behind = 0,
  leaving = null,
  onSwipe,
  swipeLabels,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  /** How many items wait under this one; at most two are drawn. */
  behind?: number;
  leaving?: InboxDeckExit | null;
  onSwipe?: (direction: InboxSwipe) => void;
  /** What each way does, stamped on the card while it is dragged: { right: "Done", left: "Later" }. */
  swipeLabels?: Record<InboxSwipe, React.ReactNode>;
}) {
  const card = React.useRef<HTMLDivElement>(null);
  const stamps = React.useRef<Partial<Record<InboxSwipe, HTMLSpanElement | null>>>({});
  const press = React.useRef<{ x: number; y: number; id: number; dragging: boolean } | null>(null);
  const offset = React.useRef(0);

  const paint = React.useCallback((x: number, settle: boolean) => {
    const node = card.current;
    if (!node) return;
    node.style.transition = settle
      ? 'transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)'
      : 'none';
    node.style.transform = x === 0 ? '' : `translateX(${x}px) rotate(${x / 24}deg)`;
    for (const side of ['left', 'right'] as const) {
      const stamp = stamps.current[side];
      if (!stamp) continue;
      const toward = side === 'right' ? x > 0 : x < 0;
      stamp.style.opacity = toward ? String(Math.min(1, Math.abs(x) / SWIPE_AWAY)) : '0';
    }
  }, []);

  // Sends the card off the way it is leaving, from wherever a drag left it;
  // the next card comes in with no transform at all.
  React.useLayoutEffect(() => {
    const node = card.current;
    if (!node) return;
    if (!leaving) {
      offset.current = 0;
      paint(0, false);
      node.style.opacity = '';
      return;
    }
    node.style.transition =
      'transform var(--dur-base) var(--ease-in), opacity var(--dur-base) var(--ease-in)';
    node.style.opacity = '0';
    node.style.transform =
      leaving === 'up'
        ? 'translateY(-48px) scale(0.96)'
        : `translateX(${leaving === 'right' ? 120 : -120}%) rotate(${leaving === 'right' ? 10 : -10}deg)`;
  }, [leaving, paint]);

  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = press.current;
    press.current = null;
    if (!held?.dragging || event.pointerId !== held.id) return;
    const x = offset.current;
    if (event.type === 'pointerup' && Math.abs(x) >= SWIPE_AWAY && onSwipe) {
      onSwipe(x > 0 ? 'right' : 'left');
      return;
    }
    offset.current = 0;
    paint(0, true);
  };

  return (
    <div
      data-slot="inbox-deck"
      className={cn('relative mx-auto w-full max-w-[800px] px-6 pt-6 pb-5 max-sm:px-3 max-sm:pt-3', className)}
      {...props}
    >
      <div className="relative">
        {behind >= 2 ? (
          <div
            aria-hidden
            className="absolute inset-x-7 top-0 -bottom-5 rounded-lg border border-border-subtle bg-card opacity-60"
          />
        ) : null}
        {behind >= 1 ? (
          <div
            aria-hidden
            className="absolute inset-x-3.5 top-0 -bottom-2.5 rounded-lg border border-border-subtle bg-card"
          />
        ) : null}
        <div
          ref={card}
          data-slot="inbox-deck-card"
          data-leaving={leaving ?? undefined}
          className="relative touch-pan-y rounded-lg border border-border-subtle bg-card shadow-[0_1px_2px_rgba(16,16,16,0.04),0_12px_32px_-16px_rgba(16,16,16,0.18)] will-change-transform"
          onPointerDown={(event) => {
            if (!onSwipe || leaving || event.pointerType === 'mouse') return;
            if (event.target instanceof Element && event.target.closest(SWIPE_IGNORES)) return;
            press.current = { x: event.clientX, y: event.clientY, id: event.pointerId, dragging: false };
          }}
          onPointerMove={(event) => {
            const held = press.current;
            if (!held || event.pointerId !== held.id) return;
            const x = event.clientX - held.x;
            const y = event.clientY - held.y;
            if (!held.dragging) {
              if (Math.abs(x) < SWIPE_SLOP && Math.abs(y) < SWIPE_SLOP) return;
              if (Math.abs(y) >= Math.abs(x)) {
                press.current = null;
                return;
              }
              held.dragging = true;
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // A pointer the browser no longer tracks: the drag goes on uncaptured.
              }
            }
            offset.current = x;
            paint(x, false);
          }}
          onPointerUp={release}
          onPointerCancel={release}
        >
          {swipeLabels ? (
            <>
              <span
                ref={(node) => {
                  stamps.current.right = node;
                }}
                aria-hidden
                className="pointer-events-none absolute top-5 left-5 z-10 -rotate-12 rounded-sm border-2 border-success bg-card px-2.5 py-0.5 text-[15px] font-semibold tracking-[0.04em] text-success uppercase opacity-0"
              >
                {swipeLabels.right}
              </span>
              <span
                ref={(node) => {
                  stamps.current.left = node;
                }}
                aria-hidden
                className="pointer-events-none absolute top-5 right-5 z-10 rotate-12 rounded-sm border-2 border-fg-muted bg-card px-2.5 py-0.5 text-[15px] font-semibold tracking-[0.04em] text-fg-muted uppercase opacity-0"
              >
                {swipeLabels.left}
              </span>
            </>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * InboxDeckKeys — under the deck, what the keys do: each entry its keys as
 * `Kbd` glyphs and what they do, in a quiet wrapping row. Where the pointer
 * is a finger it gives way to `touch`, the line that says how to swipe.
 */
function InboxDeckKeys({
  keys,
  touch,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  keys: readonly { keys: readonly string[]; label: React.ReactNode }[];
  touch?: React.ReactNode;
}) {
  return (
    <div
      data-slot="inbox-deck-keys"
      className={cn('mx-auto w-full max-w-[800px] px-6 pt-4 pb-8 text-[12px] text-fg-subtle max-sm:px-3', className)}
      {...props}
    >
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2 [@media(pointer:coarse)]:hidden">
        {keys.map((entry) => (
          <li key={entry.keys.join('')} className="flex items-center gap-1.5">
            <span className="flex items-center gap-0.5">
              {entry.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
            {entry.label}
          </li>
        ))}
      </ul>
      {touch ? <p className="hidden text-center [@media(pointer:coarse)]:block">{touch}</p> : null}
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

/**
 * InboxClear — nothing needs you, centred in the reading pane: the illustrated
 * `EmptyState` with the empty tray, a heading, and what is still going on
 * under it.
 */
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
    <EmptyState data-slot="inbox-clear" className={cn('pb-12', className)}>
      <EmptyState.Header>
        <EmptyState.Art name="inbox" />
        <EmptyState.Title>{title}</EmptyState.Title>
        {children ? <EmptyState.Description>{children}</EmptyState.Description> : null}
      </EmptyState.Header>
    </EmptyState>
  );
}

export {
  InboxClear,
  InboxDeck,
  InboxDeckKeys,
  inboxDeckAnswer,
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
export type { InboxDeckExit, InboxSwipe };
