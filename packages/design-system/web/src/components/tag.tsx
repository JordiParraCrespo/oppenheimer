import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

/**
 * Tag — the brand's category chip. Selected is the dark fill with white text
 * ("All agents"); unselected is white with a hairline and secondary ink
 * ("Sales", "Hotel"). Pill radius, sentence case.
 *
 * This is the *filter* chip. For a status marker use `Badge`; for a pressed
 * editor control use `Toggle`.
 */
const tagVariants = cva(
  "group/tag inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full leading-none whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      selected: {
        true: "border border-transparent bg-primary text-primary-foreground",
        false:
          "border border-border-default bg-card text-ink-600 hover:border-border-strong hover:bg-surface-hover hover:text-ink-900",
      },
      size: {
        sm: "px-2.5 py-1 text-xs/none [&_svg:not([class*='size-'])]:size-3",
        md: "px-4.5 py-2 text-base/none [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      selected: false,
      size: "md",
    },
  },
);

function Tag({
  className,
  selected = false,
  size = "md",
  render,
  ...props
}: useRender.ComponentProps<"button"> & VariantProps<typeof tagVariants>) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: "button",
        "aria-pressed": selected ?? false,
        className: cn(tagVariants({ selected, size }), className),
      },
      props,
    ),
    render,
    state: { slot: "tag", selected: selected ?? false },
  });
}

export { Tag, tagVariants };
