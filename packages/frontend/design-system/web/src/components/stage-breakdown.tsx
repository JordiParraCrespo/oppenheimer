import type * as React from "react";

import { cn } from "../lib/utils";
import { DeltaText } from "./delta-text";
import { Separator } from "./separator";

type StageBreakdownTone = "active" | "paused" | "draft" | "ended";

interface StageBreakdownItem {
  id: string;
  label: React.ReactNode;
  value: number;
  delta?: number | null;
  tone: StageBreakdownTone;
}

type StageBreakdownProps = React.ComponentProps<"div"> & {
  items: StageBreakdownItem[];
  total?: number;
  formatValue?: (value: number) => React.ReactNode;
  formatPercentage?: (percentage: number) => React.ReactNode;
  formatDelta?: (delta: number) => React.ReactNode;
};
const toneClasses: Record<StageBreakdownTone, string> = {
  active: "bg-status-active",
  paused: "bg-status-paused",
  draft: "bg-status-draft",
  ended: "bg-status-ended",
};

function StageBreakdown({
  items,
  total: suppliedTotal,
  formatValue = String,
  formatPercentage = (percentage) => `${Math.round(percentage)}%`,
  formatDelta,
  className,
  ...props
}: StageBreakdownProps) {
  const itemsTotal = items.reduce((sum, item) => sum + item.value, 0);
  const total = Math.max(suppliedTotal ?? itemsTotal, itemsTotal);
  const remainder = total - itemsTotal;

  return (
    <div data-slot="stage-breakdown" className={cn("min-w-0", className)} {...props}>
      <div aria-hidden="true" className="mb-[22px] flex h-2 gap-[3px]">
        {total > 0 ? (
          <>
            {items.map((item) => (
              <span
                key={item.id}
                className={cn("min-w-0 rounded-full", toneClasses[item.tone])}
                style={{ flexGrow: item.value, flexBasis: 0 }}
              />
            ))}
            {remainder > 0 ? (
              <span
                className="min-w-0 rounded-full bg-data-track"
                style={{ flexGrow: remainder, flexBasis: 0 }}
              />
            ) : null}
          </>
        ) : (
          <span className="w-full rounded-full bg-data-track" />
        )}
      </div>

      <div className="flex flex-col">
        {items.map((item, index) => {
          const percentage = total === 0 ? 0 : (item.value / total) * 100;

          return (
            <div key={item.id}>
              {index > 0 ? <Separator className="bg-border-subtle" /> : null}
              <div className="flex items-center gap-2.5 py-[11px]">
                <span
                  aria-hidden="true"
                  className={cn("size-[7px] shrink-0 rounded-full", toneClasses[item.tone])}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-ink-900">{item.label}</span>
                <span className="shrink-0">
                  {item.delta == null ? (
                    <span className="text-sm text-ink-400">—</span>
                  ) : (
                    <DeltaText value={item.delta} formatValue={formatDelta} caret />
                  )}
                </span>
                <span className="min-w-9 text-right text-sm font-medium text-ink-900 tabular-nums">
                  {formatValue(item.value)}
                </span>
                <span className="min-w-[34px] text-right text-[13px] text-ink-400 tabular-nums">
                  {formatPercentage(percentage)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { StageBreakdown };
export type { StageBreakdownItem, StageBreakdownProps, StageBreakdownTone };
