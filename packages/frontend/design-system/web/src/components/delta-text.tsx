import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * DeltaText — a signed percentage change, green up / red down. A number is
 * signed and suffixed automatically; pass a string to render it verbatim while
 * still deriving the direction from it.
 */
function DeltaText({
  value,
  formatValue,
  caret = false,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  value: number | string;
  formatValue?: (value: number) => React.ReactNode;
  caret?: boolean;
}) {
  const numeric =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value).replace(/[^-\d.]/g, ""));
  const up = !(numeric < 0);
  const label =
    typeof value === "number"
      ? (formatValue?.(value) ?? `${up ? "+" : ""}${value}%`)
      : value;
  const Caret = up ? ArrowUpIcon : ArrowDownIcon;

  return (
    <span
      data-slot="delta-text"
      data-direction={up ? "up" : "down"}
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
        up ? "text-data-up" : "text-data-down",
        className,
      )}
      {...props}
    >
      {caret ? <Caret className="size-3" /> : null}
      {label}
    </span>
  );
}

export { DeltaText };
