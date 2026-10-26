'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { CircleCheckIcon, ClockIcon } from 'lucide-react';
import type * as React from 'react';

import { META_GIVES_WAY, ROW_BUTTON_WITH_ACTION, SidebarRow } from '../internal/sidebar-row';
import { cn } from '../lib/utils';
import { Skeleton } from './skeleton';

/**
 * The Inbox (`product/versions/mvp/design/version1/Brain.dc.html`): what
 * needs you, one row each in the sidebar, and the one in hand as a card in
 * the pane with the log of what you did above it.
 */
function InboxList({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="inbox-list"
      role="list"
      className={cn('flex flex-col gap-0.5', className)}
      {...props}
    />
  );
}

/**
 * InboxItem — one thing that needs you: the kind's glyph, a short line, where
 * it comes from under it, and on the right a mono age (or "Low"). The item in
 * the pane is `active`, on the selected wash. A `done` row (Show done) is
 * struck through at half strength. `action` is the row's ellipsis, as on a
 * `SessionItem`: shown on hover, focus or while open, hiding the age.
 */
function InboxItem({
  title,
  from,
  meta,
  icon,
  active,
  done,
  action,
  menuOpen,
  className,
  render,
  nativeButton,
  ...props
}: Omit<ButtonPrimitive.Props, 'children'> & {
  title: string;
  from?: React.ReactNode;
  /** The age ("6m"), or "Low" for a deprioritized item. */
  meta?: React.ReactNode;
  icon: React.ReactNode;
  active?: boolean;
  done?: boolean;
  /** The row's ellipsis: a `DropdownMenu` trigger. */
  action?: React.ReactNode;
  /** Keeps the row lit and the action visible while its menu is open. */
  menuOpen?: boolean;
}) {
  const withAction = action !== undefined;
  const button = (
    <ButtonPrimitive
      data-slot="inbox-item"
      data-active={active || undefined}
      data-done={done || undefined}
      role={withAction ? undefined : 'listitem'}
      aria-current={active ? 'true' : undefined}
      render={render}
      nativeButton={nativeButton ?? render === undefined}
      className={cn(
        'group/inbox flex w-full items-start gap-2.5 rounded-sm px-2.5 py-2 text-left text-fg outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring data-active:bg-selected-surface data-done:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
        withAction && ROW_BUTTON_WITH_ACTION,
        className,
      )}
      {...props}
    >
      <span aria-hidden className="flex shrink-0 pt-0.5 text-fg-muted">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-operate tracking-[-0.009em] group-data-done/inbox:line-through">
          {title}
        </span>
        {from ? <span className="truncate text-xs text-fg-subtle">{from}</span> : null}
      </span>
      {meta ? (
        <span
          className={cn(
            'figures shrink-0 pt-0.5 text-[11px] text-fg-subtle',
            withAction && META_GIVES_WAY,
          )}
        >
          {meta}
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
      className="[&>span:last-child]:top-2 [&>span:last-child]:translate-y-0"
    >
      {button}
    </SidebarRow>
  );
}

/** An `InboxItem` while the Inbox loads: the same box, a bar per line. */
function InboxItemSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="inbox-item-skeleton"
      aria-hidden
      className={cn('flex w-full items-start gap-2.5 px-2.5 py-2', className)}
    >
      <Skeleton className="mt-0.5 size-3.5 rounded-xs" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </span>
      <Skeleton className="mt-0.5 h-3 w-5" />
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
        'flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-fg-muted [&_svg]:size-3.5 [&_svg]:shrink-0',
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

/** InboxGreeting — how the pane opens: a line in display type, and what is going on under it. */
function InboxGreeting({
  title,
  children,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="inbox-greeting" className={cn('flex flex-col gap-1.5 pb-1.5', className)}>
      <h1 className="font-display text-h2 font-semibold tracking-h2 text-balance">{title}</h1>
      {children ? <p className="text-body text-fg-muted text-pretty">{children}</p> : null}
    </div>
  );
}

/**
 * InboxLogLine — one thing you did this visit, in the pane's log: a green
 * tick, what was done, and when, in mono.
 */
function InboxLogLine({
  time,
  children,
  className,
}: {
  time: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="inbox-log-line"
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-md bg-hover-surface px-3.5 py-2.5 motion-safe:animate-appear',
        className,
      )}
    >
      <CircleCheckIcon aria-hidden className="size-3.75 shrink-0 text-success" />
      <span className="min-w-0 flex-1 truncate text-operate">{children}</span>
      <span className="figures shrink-0 text-[11.5px] text-fg-subtle">{time}</span>
    </div>
  );
}

/**
 * InboxCard — the item in hand: a round glyph, who it is from, the question
 * in a sentence and the age; then what the caller composes under it
 * (`InboxCardBody`, `InboxCardFacts`, `InboxCardActions`).
 */
function InboxCard({
  icon,
  from,
  title,
  age,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
  icon: React.ReactNode;
  from: React.ReactNode;
  title: React.ReactNode;
  age?: React.ReactNode;
}) {
  return (
    <section
      data-slot="inbox-card"
      className={cn(
        'flex flex-col gap-4 rounded-lg border border-border-subtle bg-card p-5 motion-safe:animate-appear',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-control text-fg [&_svg]:size-4"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[12.5px] text-fg-muted">{from}</span>
          <h2 className="text-h4 font-semibold tracking-h4 text-pretty">{title}</h2>
        </div>
        {age ? <span className="figures shrink-0 text-[11.5px] text-fg-subtle">{age}</span> : null}
      </div>
      {children}
    </section>
  );
}

function InboxCardBody({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="inbox-card-body"
      className={cn('text-[14.5px] leading-relaxed text-fg text-pretty', className)}
      {...props}
    />
  );
}

/** The facts under the question: a pull request's checks and size, a run's failure line. */
function InboxCardFacts({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="inbox-card-facts"
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-fg-muted', className)}
      {...props}
    />
  );
}

/**
 * The answer row: `leading` (Later, a link to the thing) on the left, the
 * answers (`children`) on the right, the primary last.
 */
function InboxCardActions({
  leading,
  children,
  className,
}: {
  leading?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="inbox-card-actions" className={cn('flex flex-wrap items-center gap-2', className)}>
      {leading ? <div className="flex flex-wrap items-center gap-2">{leading}</div> : null}
      {/* The answers keep together, on the right, and wrap as one under the rest. */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

/** InboxClear — nothing needs you: "You're clear", and what is still going on. */
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
      className={cn('flex flex-col gap-1.5 rounded-lg bg-card p-5 motion-safe:animate-appear', className)}
    >
      <span className="text-h4 font-semibold tracking-h4">{title}</span>
      {children ? <span className="text-operate leading-normal text-fg-muted">{children}</span> : null}
    </div>
  );
}

export {
  InboxCard,
  InboxCardActions,
  InboxCardBody,
  InboxCardFacts,
  InboxClear,
  InboxGreeting,
  InboxItem,
  InboxItemSkeleton,
  InboxList,
  InboxLogLine,
  InboxSnoozedRow,
};
