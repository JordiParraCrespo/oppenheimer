'use client';

import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Rail — the 56px strip left of the sidebar that switches the console between
 * its two lists: sessions and automations. A round wordmark on top, then one
 * 40px round link per list — the app hands each item the router's link
 * through `render` — muted at rest, the hover wash on hover, and the same
 * wash held while it is the current one. Hovering or focusing a button shows
 * its name to the right, with the list's count, so the rail says what and how
 * much is behind a glyph without widening.
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
  return useRender({
    defaultTagName: 'button',
    render,
    props: {
      type: render ? undefined : 'button',
      'data-slot': 'rail-item',
      'data-active': active || undefined,
      'aria-label': label,
      'aria-current': active ? 'page' : undefined,
      className: cn(
        'group/rail-item relative flex size-10 items-center justify-center rounded-pill text-fg-muted no-underline outline-none transition-[background-color,color,transform] duration-(--dur-instant) ease-standard hover:bg-hover-surface hover:text-fg hover:no-underline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:scale-[0.975] data-active:bg-hover-surface data-active:text-fg [&_svg:not([class*=size-])]:size-[18px]',
        className,
      ),
      ...props,
      children: (
        <>
          {children}
          <RailTip count={count}>{label}</RailTip>
        </>
      ),
    },
  });
}

/**
 * The name beside a rail button (`.op-rail__tip`): a popover-surface pill
 * 10px past the button's edge, drawn by the button itself rather than a
 * portal, so it shows the moment the pointer or focus arrives, no delay,
 * fading in while it slides the last 4px into place. The rail sits above the
 * sidebar, so the pill lies over the sidebar's first column. It is decoration:
 * the button's `aria-label` already names it.
 */
function RailTip({ count, children }: { count?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      data-slot="rail-tip"
      className="pointer-events-none absolute top-1/2 left-[calc(100%+10px)] flex -translate-x-1 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-md bg-popover px-2.5 py-[5px] text-[13px] text-fg opacity-0 shadow-popover transition-[opacity,translate] duration-(--dur-fast) [transition-timing-function:var(--ease-standard),var(--ease-out)] group-hover/rail-item:translate-x-0 group-hover/rail-item:opacity-100 group-focus-visible/rail-item:translate-x-0 group-focus-visible/rail-item:opacity-100"
    >
      {children}
      {count !== undefined ? (
        <span className="font-mono text-[11px] text-fg-subtle tabular-nums">{count}</span>
      ) : null}
    </span>
  );
}

export { Rail, RailItem, RailMark };
