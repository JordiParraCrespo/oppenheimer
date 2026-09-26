'use client';

import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { cn } from '../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

/**
 * Rail — the 56px strip left of the sidebar that switches the console between
 * its two lists: sessions and automations. A round wordmark on top, then one
 * 40px round link per list — the app hands each item the router's link
 * through `render` — muted at rest, the hover wash on hover, and the same
 * wash held while it is the current one. Each button's tooltip
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
  render,
  ...props
}: useRender.ComponentProps<'button'> & {
  /** The tooltip and the accessible name ("Sessions"). */
  label: string;
  /** Rides in the tooltip, mono ("Routines 5"). */
  count?: React.ReactNode;
  active?: boolean;
}) {
  // A list is a route, so the button is the router's link when the app hands
  // one through `render`; on its own it is a button.
  const item = useRender({
    defaultTagName: 'button',
    render,
    props: {
      type: render ? undefined : 'button',
      'data-slot': 'rail-item',
      'data-active': active || undefined,
      'aria-label': label,
      'aria-current': active ? 'page' : undefined,
      className: cn(
        'relative flex size-10 items-center justify-center rounded-pill text-fg-muted no-underline outline-none transition-[background-color,color,transform] duration-fast ease-standard hover:bg-hover-surface hover:text-fg hover:no-underline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:scale-[0.975] data-active:bg-hover-surface data-active:text-fg [&_svg:not([class*=size-])]:size-[18px]',
        className,
      ),
      ...props,
    },
  });
  return (
    <Tooltip>
      <TooltipTrigger render={item}>
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
