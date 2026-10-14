'use client';

import { ChevronDownIcon, ChevronUpIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
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
 * - `ChatTabStrip` · `ChatTab`: open threads as 26px tabs on the hover wash
 *   over the header; the current one on the canvas with its close, each
 *   with the run-state dot when it has one.
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
        <span className="truncate text-[14px] font-medium text-fg">{title}</span>
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
  className,
  children,
}: {
  onNew?: () => void;
  newLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="chat-tab-strip"
      role="tablist"
      className={cn('flex h-9 items-center gap-0.5 overflow-x-auto bg-hover-surface px-1.5 text-[12.5px] [scrollbar-width:none]', className)}
    >
      {children}
      {onNew ? (
        <IconButton size="sm" aria-label={newLabel} onClick={onNew}>
          <PlusIcon />
        </IconButton>
      ) : null}
    </div>
  );
}

function ChatTab({
  dot,
  active = false,
  onClose,
  closeLabel = 'Close tab',
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'button'>, 'type'> & {
  /** The run-state dot: `success` running, `warning` needs input. */
  dot?: 'success' | 'warning' | 'danger';
  active?: boolean;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <span
      data-slot="chat-tab"
      data-active={active || undefined}
      className={cn(
        'group/tab flex h-6.5 max-w-50 shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-fg-muted data-active:bg-canvas data-active:text-fg',
        onClose && active && 'pr-1',
        className,
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        className="flex min-w-0 items-center gap-1.5 outline-none focus-visible:underline"
        {...props}
      >
        {dot ? (
          <span
            aria-hidden
            className={cn('size-1.5 shrink-0 rounded-pill', dot === 'success' ? 'bg-success' : dot === 'warning' ? 'bg-warning' : 'bg-danger')}
          />
        ) : null}
        <span className="truncate">{children}</span>
      </button>
      {onClose && active ? (
        <button
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
          className="flex size-4.5 shrink-0 items-center justify-center rounded-xs text-fg-subtle outline-none hover:bg-hover-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-3" />
        </button>
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
        'inline-flex h-7 items-center gap-1.5 rounded-pill px-2.5 text-[13px] text-fg outline-none transition-colors duration-fast hover:bg-hover-surface focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-hover-surface [&_svg]:size-3.5 [&_svg]:shrink-0',
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
