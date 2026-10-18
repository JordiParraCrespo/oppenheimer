'use client';

import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * The agent chat's inline fold: a verb line whose chevron, after the words,
 * turns as the panel under it opens (a tool call group, a command's output,
 * the reasoning, the subagents). It is `Disclosure`'s primitive with the
 * chat's anatomy: the trigger hugs its words instead of spanning the row,
 * and the panel hangs where the caller puts it, with no summary and no gap.
 * Open state, `aria-expanded` and the panel's wiring are Base UI's.
 */
function Fold(props: CollapsiblePrimitive.Root.Props) {
  return <CollapsiblePrimitive.Root {...props} />;
}

function FoldTrigger({ className, children, ...props }: CollapsiblePrimitive.Trigger.Props) {
  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        'group/fold rounded-xs text-left outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      {children}
      <FoldChevron />
    </CollapsiblePrimitive.Trigger>
  );
}

function FoldPanel(props: CollapsiblePrimitive.Panel.Props) {
  return <CollapsiblePrimitive.Panel {...props} />;
}

/**
 * A run of things folded behind one summary line, hanging from a hairline
 * when open: the agent's `ToolCallGroup` and a bot's summarised `Trace`.
 * The caller sets the line's type (`triggerClassName`) and the panel's
 * padding (`panelClassName`); the fold, the chevron and the hairline are
 * this one's, so the two never drift.
 */
function FoldGroup({
  summary,
  triggerClassName,
  panelClassName,
  children,
  ...props
}: Omit<CollapsiblePrimitive.Root.Props, 'children'> & {
  /** What the trigger says, before its chevron. */
  summary: React.ReactNode;
  triggerClassName?: string;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Fold {...props}>
      <FoldTrigger className={triggerClassName}>{summary}</FoldTrigger>
      <FoldPanel className={cn('ml-1.75 flex flex-col border-l border-border-subtle', panelClassName)}>
        {children}
      </FoldPanel>
    </Fold>
  );
}

/**
 * The chevron alone, for a fold whose panel is not its own (`TurnHeader`
 * folds a turn's work elsewhere in the transcript): `open` turns it.
 * Inside a `FoldTrigger` it follows the trigger's state.
 */
function FoldChevron({ open, className }: { open?: boolean; className?: string }) {
  return (
    <ChevronRightIcon
      aria-hidden
      data-open={open || undefined}
      className={cn(
        'size-3.25 shrink-0 text-fg-subtle transition-transform duration-fast ease-standard group-data-panel-open/fold:rotate-90 data-open:rotate-90',
        className,
      )}
    />
  );
}

export { Fold, FoldChevron, FoldGroup, FoldPanel, FoldTrigger };
