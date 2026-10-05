'use client';

import { useRender } from '@base-ui/react/use-render';
import * as React from 'react';

import { cn } from '../lib/utils';
import { useSortableItem } from './drag';

/**
 * Rail — the 56px strip left of the sidebar that switches the console between
 * its areas: sessions, automations and Plan (tasks and the calendar). A round wordmark on top, then one
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
  ref,
  ...props
}: useRender.ComponentProps<'button'> & {
  /** The accessible name, and what the tip beside the button reads ("Sessions"). */
  label: string;
  /** Shown after the name in the tip, and read out as the button's description. */
  count?: React.ReactNode;
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
      'aria-label': label,
      'aria-describedby': hasCount ? countId : undefined,
      'aria-current': active ? 'page' : undefined,
      className: cn(
        'group/rail-item relative flex size-10 items-center justify-center rounded-pill text-fg-muted no-underline outline-none transition-[background-color,color,transform] duration-instant ease-standard hover:bg-hover-surface hover:text-fg hover:no-underline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:scale-[0.975] data-active:bg-hover-surface data-active:text-fg [&_svg:not([class*=size-])]:size-[18px]',
        className,
      ),
      ...props,
      children: (
        <>
          {children}
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
      className="pointer-events-none absolute top-1/2 left-[calc(100%+var(--space-5))] flex -translate-x-1 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-md bg-popover px-2.5 py-1.25 text-sm text-fg opacity-0 shadow-popover transition-[opacity,translate] duration-fast [transition-timing-function:var(--ease-standard),var(--ease-out)] group-hover/rail-item:translate-x-0 group-hover/rail-item:opacity-100 group-focus-visible/rail-item:translate-x-0 group-focus-visible/rail-item:opacity-100"
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
 * A `RailItem` the reader can drag into another place. While it moves its
 * own place is the drop slot (round, on the selected wash) and the lifted
 * copy is the caller's overlay; the neighbours slide.
 */
function SortableRailItem({
  id,
  className,
  style,
  ...props
}: React.ComponentProps<typeof RailItem> & { id: string }) {
  const { ref, handleProps, style: slide, isDragging } = useSortableItem({
    id,
    data: { type: 'rail-item', label: props.label },
  });
  return (
    <RailItem
      ref={ref}
      data-dragging={isDragging || undefined}
      style={{ ...style, ...slide }}
      className={cn(
        'touch-none data-dragging:bg-selected-surface data-dragging:shadow-[inset_0_0_0_1px_var(--ring)] data-dragging:[&>*]:invisible',
        className,
      )}
      {...handleProps}
      {...props}
    />
  );
}

export { Rail, RailItem, RailMark, SortableRailItem };
