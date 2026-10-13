'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import { CheckIcon } from 'lucide-react';

import type * as React from 'react';

import { cn } from '../lib/utils';

type PillGroupBase = Omit<
  ToggleGroupPrimitive.Props,
  'value' | 'defaultValue' | 'onValueChange' | 'multiple'
>;

type PillGroupProps = PillGroupBase &
  (
    | { multiple?: false; value: string; onValueChange: (value: string) => void }
    | { multiple: true; value: string[]; onValueChange: (value: string[]) => void }
  );

/**
 * PillGroup — a form value picked from a short row of pills (`.op-pill`):
 * For how long on Share (1 hour · 1 day · 7 days · Never), the projects and
 * repositories a bot may touch, the groups a bot may message. Each pill is
 * 30px on the hover wash at 13.5px; a picked one takes the selected wash and
 * the selected ink; pressing scales it to .975. The row wraps at 6px.
 *
 * `multiple` makes it a set (a bot's projects); without it exactly one pill
 * is on and the value is a string. A pill that cannot be picked now (7 days
 * while write access is on) is `disabled`, never hidden, and the field's
 * description says why.
 *
 * It holds a value, so it lives in a form; `PillTabs` switches what a page
 * shows and `SegmentedControl` how one pane reads.
 *
 * ```tsx
 * <PillGroup value={ttl} onValueChange={setTtl} aria-label="For how long">
 *   <PillGroupItem value="1h">1 hour</PillGroupItem>
 *   <PillGroupItem value="never" disabled>Never</PillGroupItem>
 * </PillGroup>
 * ```
 */
function PillGroup({ value, onValueChange, multiple = false, className, ...props }: PillGroupProps) {
  return (
    <ToggleGroupPrimitive
      data-slot="pill-group"
      multiple={multiple}
      value={Array.isArray(value) ? value : [value]}
      onValueChange={(next) => {
        const picked = next.filter((v): v is string => typeof v === 'string');
        if (multiple) return (onValueChange as (v: string[]) => void)(picked);
        // One stays on: a click on the picked pill keeps it.
        const one = picked.find((v) => v !== value);
        if (one !== undefined) (onValueChange as (v: string) => void)(one);
      }}
      className={cn('flex flex-wrap gap-1.5', className)}
      {...props}
    />
  );
}

/**
 * One pill. `count` rides after the label in mono; `mono` sets the label in
 * mono (a repository's `owner/name`); `check` draws the 16px round box first,
 * for a set whose pills read as ticks (Always ask before). `leading` is an
 * 18px `Avatar` before the label (Allowed bots), which tightens the pill's
 * left edge to it; an icon is a child.
 */
function PillGroupItem({
  count,
  mono = false,
  check = false,
  leading,
  className,
  children,
  ...props
}: TogglePrimitive.Props & {
  count?: React.ReactNode;
  mono?: boolean;
  check?: boolean;
  leading?: React.ReactNode;
}) {
  return (
    <TogglePrimitive
      data-slot="pill-group-item"
      className={cn(
        'group/pill inline-flex h-7.5 items-center gap-1.75 rounded-pill bg-hover-surface px-3 text-[13.5px] whitespace-nowrap text-fg outline-none transition-[background-color,color,transform] duration-instant ease-standard select-none hover:bg-control-hover active:scale-[0.975] focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-disabled:opacity-40 data-pressed:bg-selected-surface data-pressed:text-selected-fg [&_svg]:shrink-0',
        mono && 'font-mono text-[12.5px]',
        check && 'pl-2',
        leading !== undefined && 'pl-1.5',
        className,
      )}
      {...props}
    >
      {check ? (
        <span
          aria-hidden
          className="flex size-4 flex-none items-center justify-center rounded-pill border-[1.5px] border-border text-transparent transition-colors duration-instant ease-standard group-data-pressed/pill:border-primary group-data-pressed/pill:bg-primary group-data-pressed/pill:text-white"
        >
          <CheckIcon className="size-2.5 stroke-[3]" />
        </span>
      ) : null}
      {leading}
      {children}
      {count !== undefined ? <span className="figures font-mono text-[11px] text-fg-subtle">{count}</span> : null}
    </TogglePrimitive>
  );
}

export { PillGroup, PillGroupItem };
