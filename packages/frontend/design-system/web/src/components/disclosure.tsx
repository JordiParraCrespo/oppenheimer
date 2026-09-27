'use client';

import { ChevronDownIcon } from 'lucide-react';
import * as React from 'react';

import { useControlled } from '../hooks/use-controlled';
import { cn } from '../lib/utils';

/**
 * Disclosure — a section of a form or dialog that folds away: a borderless
 * row with its words on the left and a chevron on the right, the part it
 * hides under it. The project dialog's "Defaults · optional" and Add a host's
 * "Inspect command and prompt" (`design/version1/SessionsConsole.dc.html`).
 *
 * `variant` is which of the two rows it is: `label` reads as a field's label
 * (the section is part of the form, and `meta` says it is optional); `quiet`
 * is the 13px muted line for what most readers never open. `summary` is what
 * the folded section holds, shown only while it is folded, so a closed
 * section still says what it will do.
 *
 * Hand-built rather than Base UI's Collapsible: it is a button with
 * `aria-expanded` and a panel that is there or not, and every design-system
 * component lands on the console's first load (`scripts/check-bundle-size.mjs`).
 *
 * ```tsx
 * <Disclosure>
 *   <DisclosureTrigger meta="optional" summary="mac-studio · Claude Code">Defaults</DisclosureTrigger>
 *   <DisclosurePanel>…</DisclosurePanel>
 * </Disclosure>
 * ```
 */
type DisclosureState = { open: boolean; toggle: () => void; panelId: string };

const DisclosureContext = React.createContext<DisclosureState | null>(null);

function useDisclosure(part: string): DisclosureState {
  const state = React.useContext(DisclosureContext);
  if (!state) throw new Error(`<${part}> must be inside <Disclosure>`);
  return state;
}

function Disclosure({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useControlled({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const panelId = React.useId();
  const state = { open, toggle: () => setOpen(!open), panelId };

  return (
    <DisclosureContext.Provider value={state}>
      <div
        data-slot="disclosure"
        data-open={open || undefined}
        className={cn('flex flex-col', className)}
        {...props}
      />
    </DisclosureContext.Provider>
  );
}

function DisclosureTrigger({
  variant = 'label',
  meta,
  summary,
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<'button'> & {
  variant?: 'label' | 'quiet';
  /** A word after the label ("optional"), in the subtle ink. */
  meta?: React.ReactNode;
  /** What the folded section holds, shown while it is folded. */
  summary?: React.ReactNode;
}) {
  const { open, toggle, panelId } = useDisclosure('DisclosureTrigger');

  return (
    <button
      type="button"
      data-slot="disclosure-trigger"
      data-variant={variant}
      data-open={open || undefined}
      aria-expanded={open}
      aria-controls={panelId}
      className={cn(
        'group/disclosure flex w-full cursor-pointer items-center gap-2 rounded-xs text-left text-fg outline-none focus-visible:ring-3 focus-visible:ring-ring',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) toggle();
      }}
      {...props}
    >
      <span
        className={cn(
          'shrink-0',
          variant === 'label' ? 'text-sm leading-snug font-medium text-fg' : 'text-[13px] text-fg-muted',
        )}
      >
        {children}
      </span>
      {meta ? <span className="shrink-0 text-[13px] text-fg-subtle">{meta}</span> : null}
      <span className="flex-1" />
      {summary && !open ? (
        <span className="min-w-0 truncate text-[12.5px] text-fg-subtle">{summary}</span>
      ) : null}
      <ChevronDownIcon
        aria-hidden
        className="size-4 shrink-0 text-fg-subtle transition-transform duration-fast ease-standard group-data-open/disclosure:rotate-180"
      />
    </button>
  );
}

/** What the section holds; it rises in below the row when opened. */
function DisclosurePanel({ className, ...props }: React.ComponentProps<'div'>) {
  const { open, panelId } = useDisclosure('DisclosurePanel');
  if (!open) return null;

  return (
    <div
      id={panelId}
      data-slot="disclosure-panel"
      className={cn('animate-in fade-in-0 slide-in-from-top-1 duration-fast', className)}
      {...props}
    />
  );
}

export { Disclosure, DisclosurePanel, DisclosureTrigger };
