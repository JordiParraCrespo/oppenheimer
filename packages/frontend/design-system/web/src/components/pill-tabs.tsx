'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import type * as React from 'react';

import { cn } from '../lib/utils';

type PillTabsSize = 'md' | 'sm';

/**
 * PillTabs — switches views inside a page: Routines / Runs at the top, the
 * template categories, the run status tabs. Bare pills with no track; the
 * selected one takes a tonal fill (the card colour on the canvas, the hover
 * wash inside a card), never a colour. A `count` rides inside the tab in
 * mono, and a label that is a name a machine reads (`SOUL.md`) is set in
 * mono with `mono`. Two sizes: `md` (32px, 14px medium) for a page's top row, `sm`
 * (28px, 13px) inside a card's filter row or under a heading.
 *
 * Exactly one tab is on, so the value is a string. For a form's two ways to
 * read one panel use `SegmentedControl`; for a route, tabs are links.
 */
function PillTabs({
  value,
  onValueChange,
  size = 'md',
  className,
  ...props
}: Omit<ToggleGroupPrimitive.Props, 'value' | 'defaultValue' | 'onValueChange' | 'multiple'> & {
  value: string;
  onValueChange: (value: string) => void;
  size?: PillTabsSize;
}) {
  return (
    <ToggleGroupPrimitive
      data-slot="pill-tabs"
      data-size={size}
      value={[value]}
      onValueChange={(next) => {
        const picked = next[0];
        if (typeof picked === 'string' && picked !== value) onValueChange(picked);
      }}
      className={cn('group/tabs flex flex-wrap gap-0.5', className)}
      {...props}
    />
  );
}

function PillTab({
  count,
  mono = false,
  className,
  children,
  ...props
}: TogglePrimitive.Props & { count?: React.ReactNode; mono?: boolean }) {
  return (
    <TogglePrimitive
      data-slot="pill-tab"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill whitespace-nowrap text-fg-muted outline-none transition-[background-color,color] duration-fast ease-standard hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 data-pressed:text-fg',
        'group-data-[size=md]/tabs:h-8 group-data-[size=md]/tabs:px-3.5 group-data-[size=md]/tabs:text-operate group-data-[size=md]/tabs:font-medium group-data-[size=md]/tabs:tracking-[-0.006em] group-data-[size=md]/tabs:data-pressed:bg-card',
        'group-data-[size=sm]/tabs:h-7 group-data-[size=sm]/tabs:px-[11px] group-data-[size=sm]/tabs:text-[13px] group-data-[size=sm]/tabs:data-pressed:bg-hover-surface',
        mono && 'font-mono font-normal group-data-[size=md]/tabs:text-[13px] group-data-[size=md]/tabs:font-normal',
        className,
      )}
      {...props}
    >
      {count !== undefined ? (
        // The label and its smaller mono count share a baseline: centred
        // on their own, the mono face's taller ascent lifts the count.
        <span className="inline-flex items-baseline gap-1.5">
          <span>{children}</span>
          <span className="figures text-[11px] leading-none text-fg-subtle">{count}</span>
        </span>
      ) : (
        children
      )}
    </TogglePrimitive>
  );
}

export { PillTab, PillTabs };
export type { PillTabsSize };
