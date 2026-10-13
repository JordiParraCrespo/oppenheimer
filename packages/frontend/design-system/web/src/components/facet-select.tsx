'use client';

import { ChevronDownIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

type FacetOption = {
  value: string;
  label: React.ReactNode;
  /** How many rows this option would leave, in mono before the check. */
  count?: number;
};

/**
 * FacetSelect — one facet of a list's filter, picked from a short menu: Plan's
 * Project and Milestone, the pull-request queue's Difficulty, Checks and
 * Waiting. The first option is the facet unset ("All", "Any time"); any other
 * pick lights the trigger on the selected wash, so a narrowed list never looks
 * like the whole one. The menu is radio rows with the count each would leave
 * and the check.
 *
 * Two triggers, one per surface:
 * - `pill` (30px, Plan's board): the icon, then the facet's name while unset
 *   or the picked option's label, then the chevron; picked, it takes the
 *   selected ink.
 * - `labelled` (34px, the queue's row): the facet's name in muted ink, the
 *   current option in full ink, the chevron. The name stays, because the
 *   queue shows every facet at once.
 *
 * Several independent facets of one menu (the sessions filter) stay
 * `DropdownMenuSub`s; this is a facet that sits on the page.
 *
 * ```tsx
 * <FacetSelect label="Difficulty" options={lanes} value={lane} onValueChange={setLane} />
 * ```
 */
function FacetSelect({
  label,
  options,
  value,
  onValueChange,
  variant = 'labelled',
  icon,
  menuWidth,
  className,
}: {
  label: string;
  options: FacetOption[];
  value: string;
  onValueChange: (value: string) => void;
  variant?: 'pill' | 'labelled';
  /** The `pill` trigger's leading glyph (a folder, a milestone diamond). */
  icon?: React.ReactNode;
  menuWidth?: number;
  className?: string;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const set = current !== undefined && current !== options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-slot="facet-select"
        data-variant={variant}
        data-set={set || undefined}
        aria-label={variant === 'pill' ? label : undefined}
        className={cn(
          'inline-flex shrink-0 items-center rounded-pill whitespace-nowrap outline-none transition-[background-color,color,transform] duration-instant ease-standard select-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:shrink-0',
          variant === 'pill'
            ? 'h-7.5 gap-1.75 bg-hover-surface px-3 text-[13.5px] text-fg hover:bg-control-hover active:scale-[0.975] data-popup-open:bg-selected-surface data-set:bg-selected-surface data-set:text-selected-fg [&_svg:not([class*=size-])]:size-3.25'
            : 'h-(--control-h-md) gap-1.5 bg-hover-surface px-3 text-[13px] text-fg hover:bg-selected-surface data-popup-open:bg-selected-surface data-set:bg-selected-surface',
          className,
        )}
      >
        {variant === 'pill' ? (
          <>
            {icon}
            <span className="max-w-50 truncate">{set ? current.label : label}</span>
          </>
        ) : (
          <>
            <span className="text-fg-muted">{label}</span>
            <span className="max-w-50 truncate">{current?.label}</span>
          </>
        )}
        <ChevronDownIcon className="size-3! text-fg-subtle" />
      </DropdownMenuTrigger>
      <DropdownMenuContent style={{ minWidth: menuWidth ?? (variant === 'pill' ? 240 : 200) }}>
        <DropdownMenuRadioGroup value={current?.value} onValueChange={(next) => onValueChange(String(next))}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <span className="flex items-center gap-2.5">
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count !== undefined ? (
                  <span className="figures font-mono text-[11.5px] text-fg-subtle">{option.count}</span>
                ) : null}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { FacetSelect };
export type { FacetOption };
