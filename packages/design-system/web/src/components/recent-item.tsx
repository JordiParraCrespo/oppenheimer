import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "../lib/utils";

/**
 * RecentItem — a "Recents" sidebar row: a small status dot beside a truncating
 * label. `active` fills the dot cyan (the live indicator); otherwise it is a
 * hollow ring in tertiary ink.
 */
function RecentItem({
  label,
  active = false,
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & { label: string; active?: boolean }) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: "button",
        className: cn(
          "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-hover",
          className,
        ),
        children: (
          <>
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                active ? "bg-accent-cyan" : "border-[1.5px] border-ink-400",
              )}
            />
            <span className="min-w-0 flex-1 truncate text-base text-ink-600">
              {label}
            </span>
          </>
        ),
      },
      props,
    ),
    render,
    state: { slot: "recent-item", active },
  });
}

export { RecentItem };
