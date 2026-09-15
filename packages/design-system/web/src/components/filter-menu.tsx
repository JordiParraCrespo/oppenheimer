"use client";

import { FilterIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type FilterMenuOption = {
  value: string;
  label: string;
  /** Rendered between the checkbox and the label — the facet's own icon. */
  icon?: React.ReactNode;
  /** How many rows this facet would leave. Omit rather than pass a guess. */
  count?: number;
};

/**
 * FilterMenu — the toolbar's facet filter: a pill trigger that turns blue and
 * carries a count once anything is on, opening a menu of checkable facets with
 * the size of each on the right.
 *
 * Distinct from `SelectMenu`, which picks exactly one value and shows what it
 * picked on the trigger. This one is additive — the facets narrow together —
 * so the trigger can only report how many are on.
 *
 * The checkbox is drawn inline rather than reaching for `Checkbox`: every row
 * here is itself a button, and a real checkbox inside one would be a control
 * inside a control — two focus stops and a click target that fights its parent.
 *
 * Controlled: own `selected` and handle `onSelectedChange`.
 */
function FilterMenu({
  options,
  selected,
  onSelectedChange,
  label = "Filter",
  clearLabel = "Clear filters",
  align = "end",
  width = 236,
  className,
}: {
  options: FilterMenuOption[];
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
  label?: string;
  clearLabel?: string;
  align?: "start" | "center" | "end";
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const active = selected.length;

  function toggle(value: string) {
    onSelectedChange(
      selected.includes(value)
        ? selected.filter((entry) => entry !== value)
        : [...selected, value],
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            data-slot="filter-menu-trigger"
            data-active={active > 0 || undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-[7px] rounded-full border border-border-default bg-card px-3.25 text-sm font-medium text-ink-900 transition-colors hover:bg-surface-hover data-active:border-accent-blue data-active:bg-focus-ring",
              className,
            )}
          >
            <FilterIcon
              className={cn(
                "size-3.5",
                active ? "text-accent-blue" : "text-ink-600",
              )}
            />
            {label}
            {active > 0 ? (
              <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent-blue px-1.5 text-[11px] font-medium text-white">
                {active}
              </span>
            ) : null}
          </button>
        }
      />
      <PopoverContent
        align={align}
        className="overflow-hidden p-1.5"
        style={{ width }}
        data-slot="filter-menu-content"
      >
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role="menuitemcheckbox"
              aria-checked={on}
              onClick={() => toggle(option.value)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-base text-ink-900 transition-colors hover:bg-surface-hover [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5"
            >
              <FilterMenuCheck checked={on} />
              <span className="text-ink-400">{option.icon}</span>
              <span className="min-w-0 flex-1">{option.label}</span>
              {option.count === undefined ? null : (
                <span className="flex-none text-xs text-ink-400">
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
        <div className="mx-0.5 my-[5px] h-px bg-border-subtle" />
        <button
          type="button"
          disabled={active === 0}
          onClick={() => onSelectedChange([])}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-base text-accent-blue transition-colors not-disabled:hover:bg-surface-hover disabled:cursor-default disabled:text-ink-400"
        >
          <span className="w-[17px] flex-none" />
          <span className="min-w-0 flex-1">{clearLabel}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Internal — the square check the rows share with `MailboxPicker`. Kept
 * unexported in both files: it is a drawing, not a control, and anything that
 * needs a real checkbox should use `Checkbox`.
 */
function FilterMenuCheck({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-[17px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors",
        checked
          ? "border-accent-blue bg-accent-blue"
          : "border-border-strong bg-transparent",
      )}
    >
      {checked ? (
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M2.5 6.2l2.2 2.2 4.8-4.8"
            fill="none"
            stroke="#fff"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

export { FilterMenu, type FilterMenuOption };
