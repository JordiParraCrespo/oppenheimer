import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * Kbd — the keyboard-shortcut chip: a tinted 11px capsule on the sunken
 * surface, used for ⌘K on a search trigger and for shortcuts in menus.
 *
 * It deliberately opts out of two inherited defaults. A bare `<kbd>` picks up
 * the UA's monospace face, which renders ⌘ and the letter at visibly different
 * widths from the rest of the interface; and the brand's -0.15px tracking is
 * meant for running text, not for a two-glyph chip, where it crowds the pair.
 * So this sets the sans stack, and `tracking-wide` — which in this scale is the
 * 0px step, since `tracking-normal` is mapped to the brand's -0.15px.
 */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex items-center rounded-[6px] border border-border-subtle bg-surface-sunken px-1.5 py-0.5 font-sans text-[11px] leading-[13px] tracking-wide text-ink-400",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
