import type * as React from "react";

import { cn } from "../lib/utils";
import { Card } from "./card";
import { DeltaText } from "./delta-text";
import { Sparkline } from "./sparkline";

/**
 * Kpi — a bare stat block for the metric strip above a chart: label, 24px
 * value, delta. `selected` adds the active underline; `divider` draws the left
 * hairline that separates strip items after the first.
 */
function Kpi({
  label,
  value,
  delta,
  icon,
  selected = false,
  divider = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  label: string;
  value: React.ReactNode;
  delta?: number | string;
  icon?: React.ReactNode;
  selected?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      data-slot="kpi"
      data-selected={selected || undefined}
      className={cn(
        "min-w-0 flex-1 border-b-2 px-5 py-3.5",
        divider && "border-l border-l-border-subtle",
        selected ? "border-b-ink-900" : "border-b-transparent",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5 text-sm text-ink-600 [&_svg]:size-3.5 [&_svg]:text-ink-400">
        {icon}
        {label}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-2.5">
        <span className="text-2xl font-medium text-ink-900 tabular-nums">
          {value}
        </span>
        {delta != null ? <DeltaText value={delta} className="text-xs" /> : null}
      </div>
    </div>
  );
}

/**
 * KpiCard — the bordered metric card from the analytics grid: icon + label,
 * value + delta, and a small sparkline on the right. Bar sparklines sit on the
 * neutral track; line sparklines take the delta's direction colour.
 */
function KpiCard({
  label,
  value,
  delta,
  icon,
  spark,
  sparkType = "bar",
  className,
  ...props
}: React.ComponentProps<typeof Card> & {
  label: string;
  value: React.ReactNode;
  delta?: number | string;
  icon?: React.ReactNode;
  spark?: number[];
  sparkType?: "line" | "bar";
}) {
  const down =
    typeof delta === "number" ? delta < 0 : String(delta ?? "").includes("-");

  return (
    <Card
      data-slot="kpi-card"
      className={cn("gap-0 px-4.5 py-4", className)}
      {...props}
    >
      <div className="flex items-center gap-1.5 text-sm text-ink-600 [&_svg]:size-3.5 [&_svg]:text-ink-400">
        {icon}
        {label}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-medium text-ink-900 tabular-nums">
            {value}
          </span>
          {delta != null ? (
            <DeltaText value={delta} className="text-xs" />
          ) : null}
        </div>
        {spark && spark.length > 0 ? (
          <Sparkline
            data={spark}
            type={sparkType}
            width={84}
            height={30}
            color={
              sparkType === "bar"
                ? "var(--data-track)"
                : down
                  ? "var(--data-down)"
                  : "var(--data-up)"
            }
          />
        ) : null}
      </div>
    </Card>
  );
}

export { Kpi, KpiCard };
