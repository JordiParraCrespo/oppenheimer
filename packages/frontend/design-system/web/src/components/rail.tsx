'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

/**
 * Rail — the 56px strip left of the sidebar that switches the console between
 * its two lists: sessions and routines. A round wordmark on top, then one
 * 40px round button per list, muted at rest, the hover wash on hover, and
 * the same wash held while it is the current one. Each button's tooltip
 * opens to the right and carries the list's count, so the rail says how much
 * is behind a glyph without widening.
 *
 * The rail is console chrome and sits on the sidebar's surface, with a
 * hairline on its right. The kit composes it beside `Sidebar`; the showcase
 * renders it on its own.
 */
function Rail({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      data-slot="rail"
      className={cn(
        'relative z-20 flex w-14 shrink-0 flex-col items-center gap-1.5 border-r border-border-subtle bg-sidebar py-3.5',
        className,
      )}
      {...props}
    />
  );
}

/** The 32px round mark at the top: the product's initial in display weight. */
function RailMark({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="rail-mark"
      className={cn(
        'mb-2.5 flex size-8 items-center justify-center rounded-pill bg-fg font-display text-[16px] font-semibold tracking-[-0.02em] text-sidebar',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function RailItem({
  label,
  count,
  active,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  /** The tooltip and the accessible name ("Sessions"). */
  label: string;
  /** Rides in the tooltip, mono ("Routines 5"). */
  count?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            data-slot="rail-item"
            data-active={active || undefined}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex size-10 items-center justify-center rounded-pill text-fg-muted outline-none transition-[background-color,color,transform] duration-fast ease-standard hover:bg-hover-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:scale-[0.975] data-active:bg-hover-surface data-active:text-fg [&_svg:not([class*=size-])]:size-[18px]',
              className,
            )}
            {...props}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="flex items-center gap-2">
        {label}
        {count !== undefined ? <span className="figures opacity-70">{count}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

export { Rail, RailItem, RailMark };
