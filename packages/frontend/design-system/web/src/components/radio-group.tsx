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
  className,
  ...props
}: Omit<RadioGroupPrimitive.Props, 'value' | 'defaultValue' | 'onValueChange'> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
      className={cn('flex flex-col gap-1', className)}
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

export { RadioGroup, RadioGroupItem };
