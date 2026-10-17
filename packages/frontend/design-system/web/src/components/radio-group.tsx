'use client';

import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * RadioGroup — one value out of a few, each a row that says what it does: a
 * review's verdict (Comment; Approve and merge; Request changes). A row is
 * the 16px ring (filled with the action blue's dot while chosen), its label
 * and an optional line under it; the whole row picks, and the chosen one
 * rests on the selected wash. For two or three ways to read one panel, use
 * `SegmentedControl`; for a pick in a menu, `DropdownMenuRadioGroup`.
 */
function RadioGroup({
  value,
  onValueChange,
  columns,
  className,
  ...props
}: Omit<RadioGroupPrimitive.Props, 'value' | 'defaultValue' | 'onValueChange'> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Lay `RadioGroupCard`s out side by side, 8px apart. */
  columns?: 2 | 3;
}) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
      className={cn(
        columns === 2
          ? 'grid grid-cols-2 gap-2'
          : columns === 3
            ? 'grid grid-cols-3 gap-2'
            : 'flex flex-col gap-1',
        className,
      )}
      {...props}
    />
  );
}

function RadioGroupItem({
  value,
  label,
  description,
  className,
}: {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the radio inside it.
    <label
      data-slot="radio-group-item"
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-sm px-2.5 py-[7px] transition-colors duration-instant ease-standard hover:bg-hover-surface has-data-checked:bg-selected-surface',
        className,
      )}
    >
      <RadioPrimitive.Root
        value={value}
        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-pill border-[1.5px] border-border-strong outline-none focus-visible:ring-3 focus-visible:ring-ring data-checked:border-primary"
      >
        <RadioPrimitive.Indicator className="size-1.5 rounded-pill bg-primary" />
      </RadioPrimitive.Root>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13.5px] font-medium text-fg">{label}</span>
        {description ? <span className="text-xs leading-[1.4] text-pretty text-fg-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/**
 * RadioGroupCard — the same pick drawn as a card, for two or three choices
 * that each change what follows (a share's Can view / Can write). A 14-radius
 * card on a hairline: an icon and the label on its first line, what it does
 * under it. The chosen card takes the action blue's border, the selected wash
 * and a blue icon; `tone="danger"` is for the one choice that hands a machine
 * to somebody else, and turns the chosen card's border, wash and icon red.
 * The group lays them out with `columns`.
 */
function RadioGroupCard({
  value,
  label,
  description,
  icon,
  tone = 'default',
  disabled,
  className,
}: {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <RadioPrimitive.Root
      value={value}
      disabled={disabled}
      data-slot="radio-group-card"
      data-tone={tone}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border border-border-subtle px-3.5 py-3 text-left outline-none transition-[background-color,border-color,opacity] duration-instant ease-standard focus-visible:ring-3 focus-visible:ring-ring',
        'enabled:cursor-pointer enabled:hover:bg-hover-surface disabled:opacity-45',
        'data-checked:border-primary data-checked:bg-selected-surface',
        'data-[tone=danger]:data-checked:border-danger/45 data-[tone=danger]:data-checked:bg-danger/6',
        'group/radio-card',
        className,
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-fg">
        {icon ? (
          <span className="flex text-fg-subtle group-data-checked/radio-card:text-primary group-data-[tone=danger]/radio-card:group-data-checked/radio-card:text-danger [&_svg]:size-3.75">
            {icon}
          </span>
        ) : null}
        {label}
      </span>
      {description ? (
        <span className="text-[12.5px] leading-[1.4] text-pretty text-fg-muted">{description}</span>
      ) : null}
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupCard, RadioGroupItem };
