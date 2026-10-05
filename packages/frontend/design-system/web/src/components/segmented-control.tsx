'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';

import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * SegmentedControl — two or three ways to read the same thing, one of them
 * always on (Command / Agent prompt). A pill on the
 * hover surface with 2px of inset; the active segment lifts onto the card
 * colour in full ink, the others sit muted. 11.5px, because it labels a panel
 * rather than acting on it. Never a form value: for that, `RadioGroup`.
 *
 * Exactly one segment is on, so the value is a string, not the primitive's
 * array.
 *
 * `size` is the track's: `sm` (the default, 11.5px) labels a panel; `md`
 * (28px, 13px medium) switches what a page's pane shows (Briefing /
 * Description / Changes, a lane); `lg` (32px, 13.5px medium) is a page's
 * own top row (Mine / Review requests / Watching). An item's `count` rides
 * after its label in mono.
 *
 * ```tsx
 * <SegmentedControl value={tab} onValueChange={setTab} aria-label="Format">
 *   <SegmentedControlItem value="cmd">Command</SegmentedControlItem>
 *   <SegmentedControlItem value="prompt">Agent prompt</SegmentedControlItem>
 * </SegmentedControl>
 * ```
 */
function SegmentedControl({
  value,
  onValueChange,
  size = 'sm',
  className,
  ...props
}: Omit<ToggleGroupPrimitive.Props, 'value' | 'defaultValue' | 'onValueChange' | 'multiple'> & {
  value: string;
  onValueChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <ToggleGroupPrimitive
      data-slot="segmented-control"
      data-size={size}
      value={[value]}
      onValueChange={(next) => {
        const picked = next[0];
        if (typeof picked === 'string' && picked !== value) onValueChange(picked);
      }}
      className={cn('group/segmented inline-flex w-fit gap-0.5 rounded-pill bg-hover-surface p-0.5 data-[size=lg]:p-1', className)}
      {...props}
    />
  );
}

function SegmentedControlItem({
  count,
  className,
  children,
  ...props
}: TogglePrimitive.Props & { count?: React.ReactNode }) {
  return (
    <TogglePrimitive
      data-slot="segmented-control-item"
      className={cn(
        'inline-flex items-center gap-2 rounded-pill px-[9px] py-[3px] text-[11.5px] leading-normal whitespace-nowrap text-fg-muted outline-none transition-[background-color,color] duration-fast ease-standard hover:text-fg focus-visible:ring-2 focus-visible:ring-ring data-pressed:bg-card data-pressed:text-fg',
        'group-data-[size=md]/segmented:h-7 group-data-[size=md]/segmented:px-3.5 group-data-[size=md]/segmented:py-0 group-data-[size=md]/segmented:text-[13px] group-data-[size=md]/segmented:font-medium',
        'group-data-[size=lg]/segmented:h-8 group-data-[size=lg]/segmented:px-4 group-data-[size=lg]/segmented:py-0 group-data-[size=lg]/segmented:text-[13.5px] group-data-[size=lg]/segmented:font-medium',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? <span className="figures text-micro font-normal text-fg-subtle">{count}</span> : null}
    </TogglePrimitive>
  );
}

export { SegmentedControl, SegmentedControlItem };
