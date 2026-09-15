import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ChevronRightIcon } from "lucide-react";

import { cn } from "../lib/utils";

/**
 * PromptCard — a suggested-prompt row from the assistant's empty state: a
 * tiled icon, the prompt title over a one-line description, and a trailing
 * chevron. Card radius, hairline border, no elevation.
 */
function PromptCard({
  icon,
  title,
  description,
  className,
  render,
  ...props
}: useRender.ComponentProps<"button"> & {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: "button",
        className: cn(
          "flex w-full items-center gap-3 rounded-2xl border border-border-subtle bg-card px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-hover",
          className,
        ),
        children: (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-border-subtle bg-surface-canvas [&_svg]:size-4 [&_svg]:text-ink-600">
              {icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium text-ink-900">
                {title}
              </span>
              {description ? (
                <span className="mt-0.5 block text-sm text-ink-600">
                  {description}
                </span>
              ) : null}
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-ink-400" />
          </>
        ),
      },
      props,
    ),
    render,
    state: { slot: "prompt-card" },
  });
}

export { PromptCard };
