"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";
import { SearchIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

const searchInputVariants = cva(
  "inline-flex w-64 items-center gap-2.5 rounded-full border border-border-default bg-card px-3 transition-colors hover:border-border-strong",
  {
    variants: {
      size: {
        sm: "h-7",
        default: "h-9",
        lg: "h-11",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

/**
 * SearchInput — the quiet pill search field from the workspace topbar: a
 * leading line icon, the field itself, and an optional keyboard hint.
 *
 * Rendered as a `div` wrapper so the whole pill takes the focus ring; the
 * inner input carries no border of its own.
 */
function SearchInput({
  placeholder = "Search",
  hint = "⌘K",
  className,
  containerClassName,
  size = "default",
  ...props
}: Omit<React.ComponentProps<"input">, "size"> &
  VariantProps<typeof searchInputVariants> & {
  hint?: React.ReactNode;
  containerClassName?: string;
}) {
  return (
    <div
      data-slot="search-input"
      data-size={size}
      className={cn(searchInputVariants({ size }), containerClassName)}
    >
      <SearchIcon className="size-4 shrink-0 text-ink-400" />
      <InputPrimitive
        type="search"
        placeholder={placeholder}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-base text-ink-900 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden",
          className,
        )}
        {...props}
      />
      {hint ? (
        <kbd className="shrink-0 font-sans text-xs text-ink-400">{hint}</kbd>
      ) : null}
    </div>
  );
}

export { SearchInput, searchInputVariants };
