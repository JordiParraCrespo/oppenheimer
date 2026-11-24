'use client';

import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Launcher — what an empty pane offers to open, as a short column of large
 * rows centred in it (the session's side pane: Review, Terminal, Browser,
 * Side chats). Each `LauncherItem` is a row on the 42px rung on the hover wash at the
 * 14 radius: its glyph, its name, and on the right a quiet `detail` that
 * says what is there before it is opened ("5 files · +186 −14"). A
 * `LauncherHeading` names a group the pane offers only sometimes. Rows are
 * buttons; one whose open is under way is `busy`, and says so in its name.
 */
function Launcher({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="launcher"
      role="list"
      className={cn('mx-auto flex w-full max-w-110 flex-col gap-2 px-6', className)}
      {...props}
    />
  );
}

function LauncherItem({
  icon,
  detail,
  busy = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'button'>, 'type'> & {
  icon: React.ReactNode;
  /** What is there before it is opened, quiet on the right. */
  detail?: React.ReactNode;
  /** Its open is under way: the row stays put and cannot be pressed twice. */
  busy?: boolean;
}) {
  return (
    <div role="listitem" className="flex">
      <button
        type="button"
        data-slot="launcher-item"
        aria-busy={busy || undefined}
        disabled={busy || props.disabled}
        className={cn(
          'flex h-(--control-h-lg) min-w-0 flex-1 items-center gap-3.5 rounded-md bg-hover-surface px-4 text-left text-[14px] text-fg outline-none transition-colors duration-fast ease-standard hover:bg-active-surface focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-busy:opacity-100 [&_svg]:size-4.5 [&_svg]:shrink-0 [&_svg]:text-fg-muted',
          className,
        )}
        {...props}
      >
        {icon}
        <span className={cn('min-w-0 flex-1 truncate', busy && 'motion-safe:animate-shimmer')}>{children}</span>
        {detail ? <span className="figures shrink-0 text-[12.5px] text-fg-muted">{detail}</span> : null}
      </button>
    </div>
  );
}

function LauncherHeading({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="launcher-heading"
      role="presentation"
      className={cn('mt-3 px-1 text-[12px] text-fg-muted', className)}
      {...props}
    />
  );
}

export { Launcher, LauncherHeading, LauncherItem };
