'use client';

import { ChevronDownIcon, ChevronUpIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { IconButton } from './icon-button';

/**
 * The chat's chrome (Chat Components, Header, find and empty state).
 *
 * - `ChatHeader`: 48px: what leads (the sidebar toggle, the bot's 26px
 *   photo), the title at 14px medium and its `meta` (a branch as a mono
 *   pill, a role in muted ink), the run state, the view `tabs` (Chat ·
 *   View · Stats), then the actions (open in, terminal, diff, panels).
 * - `ChatHeaderTag`: the 22px mono pill beside the title (a branch).
 * - `ChatTabStrip` · `ChatTab`: open things as tabs on the 34px rung, each with its
 *   mark and the dot of what it needs from the reader; the shown one lit on
 *   the card inside a hairline, the rest flat, a close on each.
 * - `ThreadFindBar`: ⌘F, floating top-right over the header: a 44px pill
 *   field with the close, and once there is a query, a row under it with
 *   previous, next and "2 / 7 results".
 * - `ChatEmptyState`: an empty thread: the statement at 34px display, the
 *   composer, and under it the tray of what the run will use (project,
 *   environment, branch), each a quiet `ChatTrayButton`. Centred, it opens a
 *   new bot's chat over the templates it can start from.
 */
function ChatHeader({
  leading,
  title,
  meta,
  status,
  tabs,
  actions,
  className,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** The run state: a pulsing `StatusDot` and its word. */
  status?: React.ReactNode;
  tabs?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      data-slot="chat-header"
      className={cn('flex h-12 shrink-0 items-center gap-2.5 bg-canvas pr-2.5 pl-3.5', className)}
    >
      {leading}
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {/* A strip of tabs for a title fills the bar, so its tabs size against the bar and not their names. */}
        <span className="truncate text-[14px] font-medium text-fg has-[>[data-slot=chat-tab-strip]]:flex-1">{title}</span>
        {meta}
      </span>
      {status ? <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] text-fg-muted">{status}</span> : null}
      {tabs}
      {actions ? <span className="flex shrink-0 items-center gap-0.5">{actions}</span> : null}
    </header>
  );
}

function ChatHeaderTag({ icon, className, children }: { icon?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <span
      data-slot="chat-header-tag"
      className={cn(
        'inline-flex h-5.5 shrink-0 items-center gap-1.25 rounded-pill bg-hover-surface px-2 font-mono text-[11px] text-fg-muted [&_svg]:size-3',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function ChatTabStrip({
  onNew,
  newLabel = 'New tab',
  label,
  navigation = false,
  className,
  children,
}: {
  onNew?: () => void;
  newLabel?: string;
  /**
   * What the strip holds, for a screen reader ("Open sessions"). The strip's
   * ground is the bar's; a bar that is not the canvas names its colour in
   * `--chat-tab-ground`, so a dot's cutout on a flat tab matches it.
   */
  label?: string;
  /**
   * The tabs are links to pages (`ChatTab`'s `render`), not panels of this
   * view: the strip is a `nav` and the shown one is the current page.
   */
  navigation?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const Strip = navigation ? 'nav' : 'div';
  return (
    <Strip
      data-slot="chat-tab-strip"
      role={navigation ? undefined : 'tablist'}
      aria-label={label}
      className={cn('flex min-w-0 items-center gap-0.5 overflow-x-auto py-1 [scrollbar-width:none]', className)}
    >
      {children}
      {onNew ? (
        <IconButton variant="quiet" size="sm" aria-label={newLabel} onClick={onNew} className="ml-0.5 shrink-0">
          <PlusIcon />
        </IconButton>
      ) : null}
    </Strip>
  );
}

/** Each kind of dot on a tab's mark, and what a screen reader hears when the caller names nothing. */
const TAB_ATTENTION = {
  'needs-you': { label: 'Needs input', className: 'bg-warning' },
  done: { label: 'Done', className: 'bg-primary' },
  unread: { label: 'Unread', className: 'bg-primary' },
} as const;

/**
 * One open thing in a `ChatTabStrip`: its mark, its name, its close. Every
 * tab is the same width whatever its name, the way a browser's are: 240px
 * while the strip has room, then all shrinking alike down to 96px as more
 * open, past which the strip scrolls; so lighting a tab never moves the
 * strip. The close of a tab not shown takes no room until it is hovered or
 * focused, so a narrow tab keeps its name. The shown one is lit, on the card inside a hairline, so on a strip that
 * stands on the recessed ground it reads as part of the page under it; the rest are flat on the
 * strip's ground with a hairline between two of them. A long name fades out over its last 16px
 * rather than ending in an ellipsis; a name that fits ends before the fade. What it needs from the reader is a dot on its mark (amber
 * `needs-you`, blue `done` and `unread`, as a sidebar row draws them), work
 * in flight its name's shimmer. With `render` (a router `Link`) it is a link
 * to a page, in a strip that is `navigation`.
 */
function ChatTab({
  icon,
  attention,
  attentionLabel,
  working = false,
  active = false,
  onClose,
  closeLabel = 'Close tab',
  render,
  title,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'button'>, 'type'> & {
  /** The mark before the name: an agent's, a bot's face, a glyph. */
  icon?: React.ReactNode;
  attention?: keyof typeof TAB_ATTENTION;
  attentionLabel?: string;
  /** Whether what the tab holds is at work: the name shimmers while it is. */
  working?: boolean;
  active?: boolean;
  onClose?: () => void;
  closeLabel?: string;
  /** What the tab is: a link (`<Link to=… />`) instead of a button. */
  render?: React.ReactElement;
}) {
  return (
    <span
      data-slot="chat-tab"
      data-active={active || undefined}
      title={title}
      className={cn(
        'group/tab relative flex h-(--control-h-md) min-w-24 shrink basis-60 items-center gap-2.5 rounded-sm border border-transparent pr-1 pl-3 text-[13.5px] text-fg-muted transition-colors duration-fast',
        'hover:bg-hover-surface hover:text-fg data-active:border-border-subtle data-active:bg-card data-active:font-medium data-active:text-fg',
        // A hairline between two tabs that are not shown.
        "not-first:before:absolute not-first:before:top-2.5 not-first:before:-left-0.75 not-first:before:h-3.5 not-first:before:w-px not-first:before:bg-border-subtle not-first:before:content-['']",
        'data-active:before:hidden hover:before:hidden [[data-active]+&]:before:hidden [:hover+&]:before:hidden',
        className,
      )}
    >
      <ButtonPrimitive
        role={render ? undefined : 'tab'}
        aria-selected={render ? undefined : active}
        aria-current={render && active ? 'page' : undefined}
        render={render}
        nativeButton={render === undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-2 text-current no-underline outline-none focus-visible:underline"
        {...props}
      >
        {icon || attention ? (
          <span className="relative flex shrink-0 [&_svg]:size-4">
            {icon}
            {attention ? (
              <span
                role="img"
                aria-label={attentionLabel ?? TAB_ATTENTION[attention].label}
                className={cn(
                  'absolute -top-0.75 -right-0.75 size-2 rounded-pill ring-2 ring-[var(--chat-tab-ground,var(--canvas))] group-data-active/tab:ring-card',
                  !icon && 'static',
                  TAB_ATTENTION[attention].className,
                )}
              />
            ) : null}
          </span>
        ) : null}
        <span
          className={cn(
            'min-w-0 flex-1 overflow-hidden pr-4 text-left whitespace-nowrap [mask-image:linear-gradient(90deg,#000_calc(100%-1rem),transparent)]',
            working && 'motion-safe:animate-shimmer',
          )}
        >
          {children}
        </span>
      </ButtonPrimitive>
      {onClose ? (
        <IconButton
          variant="quiet"
          size="xs"
          aria-label={closeLabel}
          onClick={onClose}
          className="hidden group-focus-within/tab:flex group-hover/tab:flex group-data-active/tab:flex focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon />
        </IconButton>
      ) : null}
    </span>
  );
}

type ThreadFindLabels = { placeholder: string; close: string; previous: string; next: string; results: (n: number, total: number) => string };

function ThreadFindBar({
  value,
  onValueChange,
  current,
  total,
  onPrevious,
  onNext,
  onClose,
  labels,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  /** The match in view, from 1. */
  current?: number;
  total?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  labels?: Partial<ThreadFindLabels>;
  className?: string;
}) {
  const label = {
    placeholder: 'Search chat…',
    close: 'Close find',
    previous: 'Previous match',
    next: 'Next match',
    results: (n: number, t: number) => `${n} / ${t} results`,
    ...labels,
  };
  return (
    <div
      data-slot="thread-find-bar"
      role="search"
      className={cn('w-80 overflow-hidden rounded-xl border border-border-subtle bg-card shadow-popover', className)}
    >
      <div className="flex h-11 items-center gap-2.5 pr-2.5 pl-4 text-[14px]">
        <SearchIcon aria-hidden className="size-3.75 shrink-0 text-fg-subtle" />
        <input
          type="search"
          value={value}
          autoFocus
          aria-label={label.placeholder}
          placeholder={label.placeholder}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'Enter') (event.shiftKey ? onPrevious : onNext)?.();
          }}
          className="min-w-0 flex-1 border-0 bg-transparent text-fg outline-none placeholder:text-fg-subtle [&::-webkit-search-cancel-button]:hidden"
        />
        <span aria-hidden className="h-4.5 w-px bg-border" />
        <IconButton size="sm" aria-label={label.close} onClick={onClose}>
          <XIcon />
        </IconButton>
      </div>
      {value !== '' ? (
        <div className="flex items-center justify-between border-t border-border-subtle px-3 py-1.5">
          <span className="flex gap-0.5">
            <IconButton size="sm" aria-label={label.previous} disabled={!total} onClick={onPrevious}>
              <ChevronUpIcon />
            </IconButton>
            <IconButton size="sm" aria-label={label.next} disabled={!total} onClick={onNext}>
              <ChevronDownIcon />
            </IconButton>
          </span>
          <span role="status" className="figures font-mono text-[12px] text-fg-muted">
            {label.results(total ? (current ?? 1) : 0, total ?? 0)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ChatEmptyState({
  title,
  tray,
  align = 'start',
  className,
  children,
}: {
  title: React.ReactNode;
  /** `center`: the statement centred over what follows, 24px apart (a new bot, over its templates). */
  align?: 'start' | 'center';
  /** `ChatTrayButton`s under the composer. */
  tray?: React.ReactNode;
  className?: string;
  /** The composer, or what to start from (`TemplateTiles`). */
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="chat-empty-state"
      data-align={align}
      className={cn('flex w-full flex-col', align === 'center' ? 'gap-6' : 'gap-3.5', className)}
    >
      <h2
        className={cn(
          'm-0 font-display text-[34px] leading-[1.1] font-semibold tracking-[-0.022em] text-balance text-fg',
          align === 'center' && 'text-center',
        )}
      >
        {title}
      </h2>
      {children}
      {tray ? <div className="flex flex-wrap gap-0.5 text-[13px]">{tray}</div> : null}
    </div>
  );
}

/** A quiet 28px pill in the empty thread's tray: a glyph, the value, a chevron. */
function ChatTrayButton({
  icon,
  mono = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'button'>, 'type'> & { icon?: React.ReactNode; mono?: boolean }) {
  return (
    <button
      type="button"
      data-slot="chat-tray-button"
      className={cn(
        'inline-flex h-(--control-h-sm) items-center gap-1.5 rounded-pill px-2.5 text-[13px] text-fg outline-none transition-colors duration-fast hover:bg-hover-surface focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-hover-surface [&_svg]:size-3.5 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {icon ? <span className="flex text-fg-muted">{icon}</span> : null}
      <span className={cn(mono && 'font-mono text-[12px]')}>{children}</span>
      <ChevronDownIcon aria-hidden className="size-3! text-fg-subtle" />
    </button>
  );
}

export { ChatEmptyState, ChatHeader, ChatHeaderTag, ChatTab, ChatTabStrip, ChatTrayButton, ThreadFindBar };
export type { ThreadFindLabels };
