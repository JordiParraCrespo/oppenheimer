'use client';

import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { cn } from '../lib/utils';
import { BrandMark } from './brand-mark';
import { useSortableControl } from './drag';

/**
 * Rail — the 56px strip left of the sidebar that switches the console between
 * its areas: sessions, automations and Plan (tasks and the calendar). The product's mark on top, then one
 * 40px round link per list — the app hands each item the router's link
 * through `render` — muted at rest, the hover wash on hover, and the same
 * wash held while it is the current one. Hovering or focusing a button shows
 * its name to the right, with the list's count, so the rail says what and how
 * much is behind a glyph without widening.
 *
 * The rail is console chrome and sits on the sidebar's surface, with a
 * hairline on its right. The kit composes it beside `Sidebar`; the showcase
 * renders it on its own.
 *
 * A reader can put the items in their own order by dragging them, on the
 * drag layer: wrap the items in a vertical `SortableGroup` inside the
 * shell's `DragProvider` and render each as a `SortableRailItem` (a
 * `RailItem` that is also a sortable item; a press still navigates, a drag
 * starts after 5px). Where the order is kept is the app's.
 *
 * Under 768px a column that never leaves takes too much of the width, so the
 * rail is a tab bar instead: a 64px pill floating 12px above the home
 * indicator and 12px in from each edge, frosted over the page, each item its
 * glyph over its short name, the current one on its own rounded wash. The
 * mark and the tips (there is no hover on a phone) are dropped. The page
 * under it keeps clear of it with `RAIL_BAR_CLEARANCE`.
 */
const RAIL = {
  surface: 'z-20 flex shrink-0 items-center',
  bar: 'fixed inset-x-3 bottom-[calc(var(--spacing)*3+env(safe-area-inset-bottom))] h-16 gap-0.5 rounded-[2rem] bg-popover/85 p-1.5 shadow-popover backdrop-blur-xl',
  column:
    'md:relative md:inset-auto md:bottom-auto md:h-auto md:w-14 md:flex-col md:justify-start md:gap-1.5 md:rounded-none md:border-border-subtle md:border-r md:bg-sidebar md:px-0 md:py-3.5 md:shadow-none md:backdrop-blur-none',
};

/** What a page beside the rail reserves at its foot, so the phone's floating bar never covers it. */
const RAIL_BAR_CLEARANCE = 'pb-[calc(var(--spacing)*22+env(safe-area-inset-bottom))] md:pb-0';

function Rail({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav data-slot="rail" className={cn(RAIL.surface, RAIL.bar, RAIL.column, className)} {...props} />;
}

/**
 * The mark at the top: the product's hat on its tile, 32px. The app makes it
 * the way home by handing the router's link through `render`, with a `label`
 * for its accessible name; on its own it is decoration.
 */
function RailMark({ className, label, render, ref, ...props }: useRender.ComponentProps<'div'> & { label?: string }) {
  return useRender({
    defaultTagName: 'div',
    render,
    ref,
    props: {
      'data-slot': 'rail-mark',
      'aria-label': label,
      'aria-hidden': label ? undefined : true,
      className: cn(
        'mb-2.5 hidden size-8 items-center justify-center rounded-md outline-none md:flex focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
        className,
      ),
      ...props,
      children: <BrandMark size={32} aria-hidden="true" />,
    },
  });
}

function RailItem({
  label,
  shortLabel,
  count,
  attention,
  active,
  className,
  children,
  render,
  ref,
  'aria-describedby': describedBy,
  ...props
}: useRender.ComponentProps<'button'> & {
  /** The accessible name, and what the tip beside the button reads ("Sessions"). */
  label: string;
  /** The name under the glyph in the phone's tab bar, when `label` is too long for it ("PRs"). */
  shortLabel?: string;
  /** Shown after the name in the tip, and read out as the button's description. */
  count?: React.ReactNode;
  /** A 7px amber dot on the corner. */
  attention?: boolean;
  active?: boolean;
}) {
  const countId = React.useId();
  const hasCount = count !== undefined && count !== null;
  // A list is a route, so the button is the router's link when the app hands
  // one through `render`; on its own it is a button.
  return useRender({
    defaultTagName: 'button',
    render,
    ref,
    props: {
      type: render ? undefined : 'button',
      'data-slot': 'rail-item',
      'data-active': active || undefined,
      'data-attention': attention || undefined,
      'aria-label': label,
      // A sortable item's drag instructions describe it too; the count stays beside them.
      'aria-describedby': [describedBy, hasCount ? countId : undefined].filter(Boolean).join(' ') || undefined,
      'aria-current': active ? 'page' : undefined,
      className: cn(
        'group/rail-item relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[1.625rem] text-fg-muted md:size-10 md:flex-none md:gap-0 md:rounded-pill no-underline outline-none transition-[background-color,color,transform] duration-instant ease-standard hover:bg-hover-surface hover:text-fg hover:no-underline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:scale-[0.975] data-active:bg-hover-surface data-active:text-fg [&_svg:not([class*=size-])]:size-[18px]',
        className,
      ),
      ...props,
      children: (
        <>
          {children}
          <span
            aria-hidden
            data-slot="rail-item-label"
            className="w-full truncate px-0.5 text-center font-medium text-[0.6875rem] leading-tight md:hidden"
          >
            {shortLabel ?? label}
          </span>
          {attention ? (
            <span
              aria-hidden
              className="absolute top-2 left-[calc(50%+var(--spacing)*1.5)] size-1.75 rounded-pill bg-warning ring-2 ring-popover md:top-1.5 md:right-1.5 md:left-auto md:ring-sidebar"
            />
          ) : null}
          <RailTip count={hasCount ? count : undefined} countId={countId}>
            {label}
          </RailTip>
        </>
      ),
    },
  });
}

/**
 * The button's name and count in a popover-surface pill to its right, drawn
 * by the button rather than through a portal so it shows the moment the
 * pointer or focus arrives, with the fade-and-rise every appearing thing
 * takes. The pill is hidden from assistive technology: the button's label is
 * its name, and the count is its description through `countId`.
 */
function RailTip({
  count,
  countId,
  children,
}: {
  count?: React.ReactNode;
  countId: string;
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      data-slot="rail-tip"
      className="pointer-events-none absolute top-1/2 left-[calc(100%+var(--space-5))] hidden -translate-x-1 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-md bg-popover px-2.5 py-1.25 text-sm text-fg opacity-0 shadow-popover transition-[opacity,translate] duration-fast [transition-timing-function:var(--ease-standard),var(--ease-out)] group-hover/rail-item:translate-x-0 group-hover/rail-item:opacity-100 group-focus-visible/rail-item:translate-x-0 group-focus-visible/rail-item:opacity-100 md:flex"
    >
      {children}
      {count !== undefined ? (
        <span id={countId} className="figures text-micro text-fg-subtle">
          {count}
        </span>
      ) : null}
    </span>
  );
}

/**
 * A `RailItem` the reader can drag into another place. It is a link and a
 * sortable item at once (`useSortableControl`): a click or Enter opens the
 * list, a drag past 5px or Space picks it up. While it moves its own place
 * is the drop slot and the lifted copy is the caller's overlay; the
 * neighbours slide.
 */
function SortableRailItem({
  id,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<typeof RailItem>, 'ref' | 'onPointerDown' | 'onKeyDown'> & { id: string }) {
  const { node, control } = useSortableControl({ id, data: { type: 'rail-item', label: props.label } });
  // The item is both the node and the control; the drag contract goes last, so the caller's props never replace it.
  return (
    <RailItem
      {...props}
      {...control}
      {...node}
      className={cn(node.className, className)}
      style={{ ...style, ...node.style }}
      ref={(element) => {
        node.ref(element);
        control.ref(element);
      }}
    />
  );
}

export { RAIL_BAR_CLEARANCE, Rail, RailItem, RailMark, SortableRailItem };
