'use client';

import { ChevronDownIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/utils';
import { ChipSelectPopup, ChipSelectSearchList } from './chip-select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Popover, PopoverTrigger } from './popover';

const TRIGGER_CLASSES =
  'inline-flex shrink-0 items-center rounded-pill whitespace-nowrap outline-none transition-[background-color,color,transform] duration-instant ease-standard select-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:shrink-0';

const TRIGGER_VARIANT = {
  pill: 'h-7.5 gap-1.75 bg-hover-surface px-3 text-[13.5px] text-fg hover:bg-control-hover active:scale-[0.975] data-popup-open:bg-selected-surface data-set:bg-selected-surface data-set:text-selected-fg [&_svg:not([class*=size-])]:size-3.25',
  labelled:
    'h-(--control-h-md) gap-1.5 bg-hover-surface px-3 text-[13px] text-fg hover:bg-selected-surface data-popup-open:bg-selected-surface data-set:bg-selected-surface',
} as const;

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
 * A facet over a list the workspace grows (Plan's projects and milestones)
 * takes `searchPlaceholder` and `emptyText`: the menu becomes the Bots
 * picker's searchable list (`ChipSelectSearchList`), the same rows with the
 * count and the check under a search field. A facet over a fixed set (the
 * lanes, the checks) stays the radio menu.
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
  searchPlaceholder,
  emptyText,
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
  /** Turns the menu into a searchable list, for a facet the workspace grows. */
  searchPlaceholder?: string;
  /** The searchable list's line when nothing matches the typed text. */
  emptyText?: (query: string) => React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value) ?? options[0];
  const set = current !== undefined && current !== options[0];
  const width = menuWidth ?? (variant === 'pill' ? 240 : 200);
  const trigger = {
    'data-slot': 'facet-select',
    'data-variant': variant,
    'data-set': set || undefined,
    'aria-label': variant === 'pill' ? label : undefined,
    className: cn(TRIGGER_CLASSES, TRIGGER_VARIANT[variant], className),
    children: (
      <>
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
      </>
    ),
  };

  if (searchPlaceholder) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger {...trigger} />
        <ChipSelectPopup density="menu" width={Math.max(width, 272)} className="p-0">
          <ChipSelectSearchList
            aria-label={label}
            options={options.map((option) => ({
              value: option.value,
              // A searchable facet's labels are text: the search reads them.
              label: String(option.label),
              count: option.count,
            }))}
            value={current?.value ?? null}
            onPick={(option) => {
              onValueChange(option.value);
              setOpen(false);
            }}
            searchPlaceholder={searchPlaceholder}
            emptyText={emptyText ?? (() => null)}
          />
        </ChipSelectPopup>
      </Popover>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger {...trigger} />
      <DropdownMenuContent style={{ minWidth: width }}>
        <DropdownMenuRadioGroup value={current?.value} onValueChange={(next) => onValueChange(String(next))}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
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
