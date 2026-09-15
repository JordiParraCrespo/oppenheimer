import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * The text field sits on the same three-step control ladder as Button and
 * IconButton — 28 / 36 / 44 (h-7 / h-9 / h-11) — so a field and a button
 * placed on one toolbar row line up without either being overridden at the
 * call site.
 *
 * `default` (36px) is the default, which is what `Button`, `SearchInput`,
 * `InputGroup` and the `DataTable` header bar all render at. `lg` is for a
 * surface built around one prominent field, not for ordinary form rows: it
 * used to be the default, and it put every dialog field two rungs above the
 * buttons beside them.
 *
 * Height is declared rather than derived from padding: when it fell out of
 * padding plus line-height, every control drifted the moment either changed.
 */
const inputVariants = cva(
  "w-full min-w-0 rounded-md border border-border-default bg-card text-base transition-[color,box-shadow,background-color,border-color] outline-none file:inline-flex file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-ink-400 hover:border-border-strong disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive",
  {
    variants: {
      size: {
        sm: "h-7 px-2.5 text-sm file:h-5 file:text-sm",
        default: "h-9 px-3 file:h-7 file:text-sm",
        lg: "h-11 px-4 file:h-8 file:text-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

function Input({
  className,
  type,
  size,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-size={size ?? "default"}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
