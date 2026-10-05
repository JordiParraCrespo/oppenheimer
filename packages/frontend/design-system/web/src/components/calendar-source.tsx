import { CheckIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * The calendar's sidebar: what it shows and where it comes from.
 *
 * - `CalendarLayerItem`: one source the month draws (a synced calendar,
 *   personal events, task due dates, automation runs), as a sidebar row
 *   with its glyph and a square check on the right. It toggles; a source
 *   that is off fades back.
 * - `CalendarSourceCard`: a connected calendar under the list, on the hover
 *   wash: the provider's mark and name, the account, and when it last
 *   synced in mono.
 */
function CalendarLayerItem({
  icon,
  checked,
  onCheckedChange,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'button'>, 'onChange'> & {
  icon?: React.ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-slot="calendar-layer"
      data-checked={checked || undefined}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'flex h-[30px] w-full items-center gap-[9px] rounded-sm px-2.5 text-left text-fg outline-none transition-[background-color,opacity] duration-fast ease-standard not-data-checked:opacity-55 hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-3.5 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden className="flex shrink-0 text-fg-subtle">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-operate tracking-[-0.009em]">{children}</span>
      <span
        aria-hidden
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors duration-fast ease-standard',
          checked ? 'border-fg bg-fg text-background' : 'border-border-strong',
        )}
      >
        {checked ? <CheckIcon className="size-2.5!" strokeWidth={3} /> : null}
      </span>
    </button>
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
      <span className="flex items-center gap-2 text-[13px] font-medium text-fg [&_svg]:size-[13px] [&_svg]:shrink-0">
        {mark}
        {name}
      </span>
      {account ? <span className="truncate text-xs text-fg-muted">{account}</span> : null}
      {status ? <span className="figures text-[11px] text-fg-subtle">{status}</span> : null}
    </div>
  );
}

export { CalendarLayerItem, CalendarSourceCard };
