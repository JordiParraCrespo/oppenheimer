"use client";

import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/**
 * SelectMenu — the toolbar filter from the analytics header: a pill trigger
 * carrying a leading icon and the current value, opening a card-radius menu
 * with a check on the active row.
 *
 * Distinct from `Select`, which is a *form* control that sits at the input
 * radius and takes a field label. This one is chrome: it lives in a toolbar,
 * shows what it is filtering by, and never has a label above it.
 *
 * Two triggers, one menu. `pill` is the bordered filter chip that sits on a
 * page toolbar; `ghost` is the compact borderless one used inside a control
 * that already has its own frame — the composer's model picker, say — where a
 * second border would read as a box inside a box.
 */
function SelectMenu({
  value,
  options,
  onValueChange,
  icon,
  variant = "pill",
  width = 240,
  align = "start",
  className,
}: {
  value: string;
  options: string[];
  onValueChange?: (value: string) => void;
  icon?: React.ReactNode;
  variant?: "pill" | "ghost";
  width?: number;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const Chevron = open ? ChevronUpIcon : ChevronDownIcon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          variant === "ghost" ? (
            <button
              type="button"
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-ink-600 transition-colors hover:bg-surface-hover [&_svg]:shrink-0",
                className,
              )}
            >
              <span className="flex items-center [&_svg]:size-3.5">{icon}</span>
              {value}
              <Chevron className="size-3" />
            </button>
          ) : (
            <Button variant="secondary" className={className}>
              {icon}
              {value}
              <Chevron className="ml-0.5 size-3.5" />
            </Button>
          )
        }
      />
      <PopoverContent
        align={align}
        className="max-w-[calc(100vw-2rem)] p-1.5"
        style={{ width }}
      >
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              onValueChange?.(option);
              setOpen(false);
            }}
            className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-base text-ink-900 transition-colors hover:bg-surface-hover"
          >
            {option}
            {value === option ? (
              <CheckIcon className="size-4 text-ink-900" />
            ) : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export { SelectMenu };
