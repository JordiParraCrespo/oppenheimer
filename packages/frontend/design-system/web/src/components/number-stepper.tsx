'use client';

import { NumberField as NumberFieldPrimitive } from '@base-ui/react/number-field';
import { MinusIcon, PlusIcon } from 'lucide-react';

import { cn } from '../lib/utils';

const STEP_BUTTON =
  'inline-flex size-(--control-h-sm) shrink-0 items-center justify-center rounded-pill text-fg-muted outline-none transition-[background-color,color,transform] duration-fast ease-standard select-none hover:bg-hover-surface hover:text-fg active:scale-[0.975] focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:size-3.25';

/**
 * NumberStepper — a small whole number with bounds a person nudges rather
 * than types: Parallel sessions (1–8), Hop limit (1–6). A pill track on the
 * hover wash with 2px of inset: minus, the value 28px wide in mono at 13.5px,
 * plus. A button at its bound turns off. The value stays typeable and the
 * arrow keys step it, so the control is a spin button to a screen reader.
 *
 * A number with a unit and room to type (a daily cap in dollars) is an
 * `Input`; this is for counts small enough to click to.
 *
 * ```tsx
 * <NumberStepper value={parallel} onValueChange={setParallel} min={1} max={8} aria-label="Parallel sessions" />
 * ```
 */
function NumberStepper({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  disabled,
  className,
  'aria-label': ariaLabel,
  labels = { decrement: 'Fewer', increment: 'More' },
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  /** The buttons' accessible names; English by default. */
  labels?: { decrement: string; increment: string };
}) {
  return (
    <NumberFieldPrimitive.Root
      data-slot="number-stepper"
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn('inline-flex', className)}
    >
      <NumberFieldPrimitive.Group className="inline-flex items-center gap-0.5 rounded-pill bg-hover-surface p-0.5 data-disabled:opacity-50">
        <NumberFieldPrimitive.Decrement aria-label={labels.decrement} className={STEP_BUTTON}>
          <MinusIcon />
        </NumberFieldPrimitive.Decrement>
        <NumberFieldPrimitive.Input
          aria-label={ariaLabel}
          className="figures w-7 bg-transparent text-center font-mono text-[13.5px] text-fg outline-none"
        />
        <NumberFieldPrimitive.Increment aria-label={labels.increment} className={STEP_BUTTON}>
          <PlusIcon />
        </NumberFieldPrimitive.Increment>
      </NumberFieldPrimitive.Group>
    </NumberFieldPrimitive.Root>
  );
}

export { NumberStepper };
