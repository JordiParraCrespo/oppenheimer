'use client';

import { Select as SelectPrimitive } from '@base-ui/react/select';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * ChipSelect — a scope decision stated as a chip: "Run X on host **mac-studio**,
 * repo **xrp-mobile**, branch **main**, with **Claude Code**". Four of them in a
 * row on New session, so the row reads as a sentence instead of a form.
 *
 * The trigger is a 34px chip at the 14px radius on the control fill with a
 * leading icon, the current value and a chevron; open, it takes the blue ring.
 * The popover is the listbox: 14px radius, options with a label, an optional
 * muted description and a check on the selected one, the selected label in the
 * link blue.
 *
 * ```tsx
 * <ChipSelect value={host} onValueChange={setHost} icon={<CpuIcon />} aria-label="Host">
 *   <ChipSelectOption value="mac-studio" description="macOS 15 · echo 38 ms">mac-studio</ChipSelectOption>
 *   <ChipSelectAction onClick={addHost} description="Install the runner on another machine">Add a host…</ChipSelectAction>
 * </ChipSelect>
 * ```
 */
function ChipSelect<Value>({
  icon,
  placeholder,
  children,
  className,
  triggerClassName,
  align = 'start',
  'aria-label': ariaLabel,
  ...props
}: SelectPrimitive.Root.Props<Value> & {
  icon?: React.ReactNode;
  placeholder?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  align?: SelectPrimitive.Positioner.Props['align'];
  'aria-label'?: string;
}) {
  return (
    <SelectPrimitive.Root {...props}>
      <SelectPrimitive.Trigger
        data-slot="chip-select-trigger"
        aria-label={ariaLabel}
        className={cn(
          'group/chip-select inline-flex h-(--control-h-md) shrink-0 items-center gap-[7px] rounded-md border border-border-subtle bg-control px-3 text-[13.5px] whitespace-nowrap text-fg outline-none transition-[background-color,border-color,box-shadow] duration-fast ease-standard hover:border-border hover:bg-control-hover data-popup-open:border-primary data-popup-open:ring-3 data-popup-open:ring-ring disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0',
          triggerClassName,
          className,
        )}
      >
        {icon ? (
          <span className="flex text-fg-subtle [&_svg:not([class*=size-])]:size-3.5">{icon}</span>
        ) : null}
        <SelectPrimitive.Value
          data-slot="chip-select-value"
          className="truncate data-placeholder:text-field-placeholder"
          placeholder={placeholder}
        />
        <SelectPrimitive.Icon
          render={
            <ChevronDownIcon className="size-3 text-fg-subtle transition-transform duration-fast group-data-popup-open/chip-select:rotate-180" />
          }
        />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          side="bottom"
          sideOffset={6}
          align={align}
          alignItemWithTrigger={false}
          className="isolate z-50"
        >
          <SelectPrimitive.Popup
            data-slot="chip-select-content"
            className="z-50 max-h-[264px] min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-md bg-popover p-1 text-fg shadow-popover outline-none transition-[opacity,transform] duration-fast ease-out data-starting-style:translate-y-1 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:translate-y-1 data-ending-style:scale-[0.98] data-ending-style:opacity-0"
          >
            <SelectPrimitive.List>{children}</SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

const OPTION_CLASSES =
  'flex w-full cursor-default items-start gap-2 rounded-sm px-2.5 py-2 text-operate text-fg outline-hidden select-none transition-colors duration-instant data-highlighted:bg-hover-surface data-disabled:pointer-events-none data-disabled:opacity-40';

function ChipSelectOption({
  className,
  children,
  description,
  ...props
}: SelectPrimitive.Item.Props & { description?: React.ReactNode }) {
  return (
    <SelectPrimitive.Item
      data-slot="chip-select-option"
      className={cn(OPTION_CLASSES, 'data-selected:text-link', className)}
      {...props}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-px text-left">
        <SelectPrimitive.ItemText className="truncate">{children}</SelectPrimitive.ItemText>
        {description ? (
          <span className="text-xs leading-snug text-fg-subtle">{description}</span>
        ) : null}
      </span>
      <span className="flex h-[1.4em] w-4 shrink-0 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-3.5" strokeWidth={2.5} />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

/**
 * A row that does something instead of choosing a value ("Add a host…"). Sits
 * after a hairline at the bottom of the list, never takes the check.
 */
function ChipSelectAction({
  className,
  children,
  description,
  onClick,
  ...props
}: React.ComponentProps<'button'> & { description?: React.ReactNode }) {
  return (
    <>
      <SelectPrimitive.Separator className="-mx-1 my-1 h-px bg-border-subtle" />
      <button
        type="button"
        data-slot="chip-select-action"
        className={cn(OPTION_CLASSES, 'hover:bg-hover-surface focus-visible:bg-hover-surface', className)}
        onClick={onClick}
        {...props}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-px text-left">
          <span className="truncate">{children}</span>
          {description ? (
            <span className="text-xs leading-snug text-fg-subtle">{description}</span>
          ) : null}
        </span>
      </button>
    </>
  );
}

function ChipSelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="chip-select-group" className={className} {...props} />;
}

function ChipSelectGroupLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="chip-select-group-label"
      className={cn('eyebrow px-2.5 pt-2.5 pb-1', className)}
      {...props}
    />
  );
}

export { ChipSelect, ChipSelectAction, ChipSelectGroup, ChipSelectGroupLabel, ChipSelectOption };
