import { PlusIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { Checkbox } from './checkbox';

/**
 * The calendar's sidebar: what it shows and where it comes from.
 *
 * - `CalendarLayerItem`: one source the month draws (a synced calendar,
 *   personal events, task due dates, automation runs), as a sidebar row
 *   with its glyph and a `Checkbox` on the right. The whole row toggles
 *   it; a source that is off fades back.
 * - `CalendarSourceCard`: a connected calendar under the list, on the hover
 *   wash: the provider's mark and name, the account, and when it last
 *   synced in mono.
 * - `CalendarAccountList`: every connected account, for more than one: a
 *   grouped list on the hover wash at the 14px radius, hairlines between
 *   `CalendarAccountRow`s and `CalendarAccountAdd` last.
 */
function CalendarLayerItem({
  icon,
  checked,
  onCheckedChange,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'label'>, 'onChange'> & {
  icon?: React.ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the Checkbox inside it.
    <label
      data-slot="calendar-layer"
      data-checked={checked || undefined}
      className={cn(
        'flex h-[30px] w-full cursor-pointer items-center gap-[9px] rounded-sm px-2.5 text-fg transition-[background-color,opacity] duration-fast ease-standard not-data-checked:opacity-55 hover:bg-hover-surface [&>svg]:size-3.5 [&>svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden className="flex shrink-0 text-fg-subtle [&_svg]:size-3.5">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-operate">{children}</span>
      <Checkbox checked={checked} onCheckedChange={(next) => onCheckedChange?.(next)} />
    </label>
  );
}

function CalendarSourceCard({
  mark,
  name,
  account,
  status,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  /** The provider's own mark (`BrandGlyph name="google"`). */
  mark?: React.ReactNode;
  name: React.ReactNode;
  account?: React.ReactNode;
  /** "Synced 2 min ago". */
  status?: React.ReactNode;
}) {
  return (
    <div
      data-slot="calendar-source-card"
      className={cn('flex flex-col gap-1 rounded-md bg-hover-surface p-3', className)}
      {...props}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-fg [&_svg]:size-[13px] [&_svg]:shrink-0">
        {mark}
        {name}
      </span>
      {account ? <span className="truncate text-xs text-fg-muted">{account}</span> : null}
      {status ? <span className="figures text-micro text-fg-subtle">{status}</span> : null}
    </div>
  );
}

function CalendarAccountList({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="calendar-account-list"
      className={cn('flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md bg-hover-surface', className)}
      {...props}
    />
  );
}

/**
 * One account: the provider's 13px mark, the address, and how its sync
 * stands in 11px mono behind a 6px dot (success while syncing, danger when
 * it failed). A failed one offers `onReconnect` as a link under the status;
 * every one has the 24px round × to disconnect.
 */
function CalendarAccountRow({
  mark,
  account,
  status,
  failed = false,
  onReconnect,
  onDisconnect,
  labels,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  /** The provider's own mark (`BrandGlyph name="google"`). */
  mark?: React.ReactNode;
  account: string;
  /** "Synced 2 min ago", "Sync failed · 3h ago". */
  status: React.ReactNode;
  failed?: boolean;
  onReconnect?: () => void;
  onDisconnect?: () => void;
  labels?: { reconnect?: string; disconnect?: (account: string) => string };
}) {
  return (
    <div
      data-slot="calendar-account-row"
      data-failed={failed || undefined}
      className={cn('flex items-start gap-2.5 py-2.5 pr-2 pl-3', className)}
      {...props}
    >
      <span aria-hidden className="mt-0.5 flex shrink-0 [&_svg]:size-[13px]">
        {mark}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="truncate text-[13px] text-fg">{account}</span>
        <span className="figures flex items-center gap-1.5 font-mono text-[11px] text-fg-subtle">
          <span aria-hidden className={cn('size-1.5 shrink-0 rounded-pill', failed ? 'bg-danger' : 'bg-success')} />
          {status}
        </span>
        {failed && onReconnect ? (
          <button
            type="button"
            onClick={onReconnect}
            className="mt-0.5 self-start text-[12px] text-link outline-none hover:underline focus-visible:underline"
          >
            {labels?.reconnect ?? 'Reconnect'}
          </button>
        ) : null}
      </span>
      {onDisconnect ? (
        <button
          type="button"
          aria-label={labels?.disconnect?.(account) ?? `Disconnect ${account}`}
          title={labels?.disconnect ? undefined : 'Disconnect'}
          onClick={onDisconnect}
          className="flex size-6 shrink-0 items-center justify-center rounded-pill text-fg-muted outline-none transition-colors duration-fast hover:bg-hover-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-3.25" />
        </button>
      ) : null}
    </div>
  );
}

/** The list's last row: connect another account. */
function CalendarAccountAdd({ className, children = 'Add account', ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-slot="calendar-account-add"
      className={cn(
        'flex h-10 items-center gap-2.5 px-3 text-left text-[13px] text-fg outline-none transition-colors duration-fast hover:bg-hover-surface focus-visible:bg-hover-surface',
        className,
      )}
      {...props}
    >
      <PlusIcon className="size-3.25 text-fg-muted" aria-hidden />
      {children}
    </button>
  );
}

export { CalendarAccountAdd, CalendarAccountList, CalendarAccountRow, CalendarLayerItem, CalendarSourceCard };
