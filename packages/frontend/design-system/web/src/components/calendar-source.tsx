import { PlusIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { TONE_BG } from '../internal/data-tone';
import { cn } from '../lib/utils';
import { Checkbox } from './checkbox';
import type { CalendarAccent } from './month-calendar';

/**
 * The calendar's sidebar: what it shows and where it comes from.
 *
 * - `CalendarLayerItem`: one source the month draws (a synced calendar,
 *   personal events, task due dates, automation runs), as a sidebar row
 *   with its glyph and a `Checkbox` on the right. The whole row toggles
 *   it; a source that is off fades back.
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
        'flex h-[30px] w-full cursor-pointer items-center gap-[9px] rounded-xs px-2.5 text-fg transition-[background-color,opacity] duration-fast ease-standard not-data-checked:opacity-55 hover:bg-hover-surface [&>svg]:size-3.5 [&>svg]:shrink-0',
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
      {/* In ink, as the frame draws a layer: a view setting, not an action. */}
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange?.(next)}
        className="data-checked:border-fg data-checked:bg-fg data-checked:text-canvas"
      />
    </label>
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
 * every one has the 24px round × to disconnect. With `accent`, an 8px swatch
 * before the address names the colour the month draws its events in.
 */
function CalendarAccountRow({
  mark,
  account,
  status,
  failed = false,
  accent,
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
  /** The colour its events wear on the month (`CalendarEntryData.accent`). */
  accent?: CalendarAccent;
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
        <span className="flex min-w-0 items-center gap-1.5">
          {accent ? <span aria-hidden className={cn('size-2 shrink-0 rounded-pill', TONE_BG[accent])} /> : null}
          <span className="truncate text-[13px] text-fg">{account}</span>
        </span>
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

export { CalendarAccountAdd, CalendarAccountList, CalendarAccountRow, CalendarLayerItem };
