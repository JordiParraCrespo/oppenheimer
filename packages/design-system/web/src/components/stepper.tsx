"use client";

import type * as React from "react";

import { cn } from "../lib/utils";

type StepTone = "default" | "won" | "lost";

/**
 * Stepper — the pipeline stage bar from the lead drawer: one flat track per
 * stage, filled up to the current one, with a 11px caption beneath. Terminal
 * stages take their own tone — green for won, red for lost — instead of the
 * blue progress fill.
 */
function Stepper({
  steps,
  value,
  onValueChange,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  steps: { value: string; label: string; tone?: StepTone }[];
  value: string;
  onValueChange?: (value: string) => void;
}) {
  const currentIndex = steps.findIndex((step) => step.value === value);
  const currentTone = steps[currentIndex]?.tone ?? "default";
  // A lost deal doesn't light the stages it passed through — only its own.
  const terminal = currentTone === "lost";

  return (
    <div data-slot="stepper" className={cn("flex gap-1", className)} {...props}>
      {steps.map((step, index) => {
        const tone = step.tone ?? "default";
        const reached = terminal
          ? step.value === value
          : index <= currentIndex && tone !== "lost";

        return (
          <button
            key={step.value}
            type="button"
            title={`Move to ${step.label}`}
            aria-current={step.value === value ? "step" : undefined}
            onClick={() => onValueChange?.(step.value)}
            className="min-w-0 flex-1 cursor-pointer text-left"
          >
            <span
              className={cn(
                "block h-1 rounded-full transition-colors",
                !reached && "bg-surface-sunken",
                reached && tone === "default" && "bg-accent-blue",
                reached && tone === "won" && "bg-status-active",
                reached && tone === "lost" && "bg-status-ended",
              )}
            />
            <span
              className={cn(
                "mt-2 block truncate text-[11px]",
                // The stage you are on is named in primary ink; the rest recede.
                step.value === value
                  ? "font-medium text-ink-900"
                  : "text-ink-400",
              )}
            >
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { Stepper };
