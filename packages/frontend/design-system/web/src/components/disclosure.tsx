'use client';

import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { ChevronDownIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Disclosure — a fold inside a dialog or a step: one row that reads as a
 * label, an optional "optional" beside it, a summary on the right when the
 * fold is closed, and a chevron that turns over 140ms; under it, the
 * content, 14px down. Add a host folds the install command and the agent
 * prompt behind "Inspect command and prompt"; the project dialog folds its
 * Defaults (`design/version1/SessionsConsole.dc.html`, `AddHost.dc.html`).
 *
 * The trigger is the whole row. `tone="muted"` is the Inspect row, whose
 * label is a 13px muted line rather than a field label.
 *
 * ```tsx
 * <Disclosure>
 *   <DisclosureTrigger meta="optional" summary="mac-studio · Claude Code">Defaults</DisclosureTrigger>
 *   <DisclosurePanel>…</DisclosurePanel>
 * </Disclosure>
 * ```
 */
function Disclosure({ className, ...props }: CollapsiblePrimitive.Root.Props) {
  return (
    <CollapsiblePrimitive.Root
      data-slot="disclosure"
      className={cn('flex flex-col', className)}
      {...props}
    />
  );
}

function DisclosureTrigger({
  meta,
  summary,
  tone = 'label',
  className,
  children,
  ...props
}: CollapsiblePrimitive.Trigger.Props & {
  /** A word after the label, in the subtle ink: "optional". */
  meta?: React.ReactNode;
  /** What the fold holds, printed on the right while it is closed. */
  summary?: React.ReactNode;
  /** `label`: the 14px medium field label. `muted`: the 13px muted line of Inspect. */
  tone?: 'label' | 'muted';
}) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="disclosure-trigger"
      data-tone={tone}
      className={cn(
        'group/disclosure flex w-full items-center gap-2 rounded-xs text-left outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          tone === 'label'
            ? 'text-sm font-medium tracking-[-0.006em] text-fg'
            : 'text-[13px] text-fg-muted',
        )}
      >
        {children}
      </span>
      {meta ? <span className="text-[13px] text-fg-subtle">{meta}</span> : null}
      <span className="flex-1" />
      {summary ? (
        <span className="min-w-0 truncate text-[12.5px] text-fg-subtle group-data-panel-open/disclosure:hidden">
          {summary}
        </span>
      ) : null}
      <ChevronDownIcon
        aria-hidden
        className="size-[15px] shrink-0 text-fg-subtle transition-transform duration-fast ease-standard group-data-panel-open/disclosure:rotate-180"
      />
    </CollapsiblePrimitive.Trigger>
  );
}

function DisclosurePanel({ className, ...props }: CollapsiblePrimitive.Panel.Props) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="disclosure-panel"
      className={cn('mt-3.5 flex flex-col', className)}
      {...props}
    />
  );
}

export { Disclosure, DisclosurePanel, DisclosureTrigger };
