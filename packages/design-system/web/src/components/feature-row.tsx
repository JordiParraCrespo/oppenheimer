import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * FeatureRow — a row inside an info card: a 20px line icon beside a medium
 * title and one supporting line ("Resume instantly / Pick up any agent run from
 * your desktop"). Stack several inside a `Card`; rows self-divide.
 */
function FeatureRow({
  icon,
  title,
  description,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div
      data-slot="feature-row"
      className={cn(
        "flex items-center gap-4 border-t border-border-subtle px-5 py-4.5 first:border-t-0 [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-ink-900",
        className,
      )}
      {...props}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-base font-medium text-ink-900">{title}</div>
        {description ? (
          <div className="mt-0.5 text-sm text-ink-400">{description}</div>
        ) : null}
      </div>
    </div>
  );
}

export { FeatureRow };
