import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * Sparkline — a tiny inline chart from a number array. `line` draws a stroked
 * path (optionally area-filled); `bar` draws even columns. Pure SVG, no
 * charting runtime — these sit inside table cells and KPI cards.
 *
 * `color` takes any CSS colour; pass a brand token
 * (`var(--data-up)`, `var(--data-line)`) rather than a hex.
 */
function Sparkline({
  data,
  type = "line",
  color = "var(--data-line)",
  width = 72,
  height = 28,
  strokeWidth = 1.6,
  fill = false,
  className,
  ...props
  // `color` and `fill` shadow the SVG presentation attributes on purpose:
  // here they mean the series colour and whether to area-fill it.
}: Omit<React.ComponentProps<"svg">, "color" | "fill"> & {
  data: number[];
  type?: "line" | "bar";
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
}) {
  const count = data.length;
  if (count === 0) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;

  if (type === "bar") {
    const gap = 2;
    const barWidth = (width - gap * (count - 1)) / count;
    return (
      <svg
        data-slot="sparkline"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-hidden="true"
        className={cn("shrink-0", className)}
        {...props}
      >
        {data.map((value, index) => {
          const barHeight = Math.max(2, ((value - min) / span) * height);
          return (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: bars are positional, not identified
              key={index}
              x={index * (barWidth + gap)}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx={Math.min(2, barWidth / 2)}
              fill={color}
            />
          );
        })}
      </svg>
    );
  }

  const x = (index: number) => (count <= 1 ? 0 : (index / (count - 1)) * width);
  const y = (value: number) =>
    height - ((value - min) / span) * (height - strokeWidth * 2) - strokeWidth;
  const path = data
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`,
    )
    .join(" ");

  return (
    <svg
      data-slot="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden="true"
      className={cn("shrink-0", className)}
      {...props}
    >
      {fill ? (
        <path
          d={`${path} L${width},${height} L0,${height} Z`}
          fill={color}
          opacity="0.1"
        />
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export { Sparkline };
