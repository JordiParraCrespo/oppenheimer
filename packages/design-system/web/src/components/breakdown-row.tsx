import type * as React from "react";

import { cn } from "../lib/utils";
import { Sparkline } from "./sparkline";

/**
 * BreakdownRow — a labelled line item with a value and a tiny trend sparkline,
 * as in "Total sales breakdown". Rows divide with a hairline; `link` tints the
 * label with the blue accent.
 */
function BreakdownRow({
  label,
  value,
  trend,
  up = true,
  link = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  label: React.ReactNode;
  value: React.ReactNode;
  trend?: number[];
  up?: boolean;
  link?: boolean;
}) {
  return (
    <div
      data-slot="breakdown-row"
      className={cn(
        "flex items-center gap-3 border-b border-border-subtle py-2.5 last:border-b-0",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "min-w-0 flex-1 text-base",
          link ? "text-accent-blue" : "text-ink-900",
        )}
      >
        {label}
      </span>
      <span className="text-base text-ink-900 tabular-nums">{value}</span>
      <span className="inline-flex w-11 justify-end">
        {trend && trend.length > 0 ? (
          <Sparkline
            data={trend}
            width={40}
            height={16}
            strokeWidth={1.4}
            color={up ? "var(--data-up)" : "var(--data-down)"}
          />
        ) : null}
      </span>
    </div>
  );
}

/**
 * TopItemRow — a ranked list row: leading media tile, name, value and share,
 * over a progress bar showing the item's share of the maximum. The "Top
 * products" pattern.
 */
function TopItemRow({
  media,
  name,
  value,
  count,
  ratio = 0.5,
  color = "var(--data-line)",
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "color"> & {
  media?: React.ReactNode;
  name: React.ReactNode;
  value: React.ReactNode;
  count?: React.ReactNode;
  ratio?: number;
  color?: string;
}) {
  return (
    <div
      data-slot="top-item-row"
      className={cn("py-2.5", className)}
      {...props}
    >
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-5.5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-sunken text-base">
          {media}
        </span>
        <span className="min-w-0 flex-1 truncate text-base text-ink-900">
          {name}
        </span>
        <span className="text-base text-ink-900 tabular-nums">{value}</span>
        {count != null ? (
          <span className="w-11 text-right text-sm text-ink-400 tabular-nums">
            {count}
          </span>
        ) : null}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-data-track">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

export { BreakdownRow, TopItemRow };
