'use client';

import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * DropdownMenu — the popover tier: 14px radius, 4px padding, the popover
 * shadow, a 4px rise plus fade over 140ms. Items are 14px rows at the 10px
 * radius with a hover wash.
 *
 * The console has three menus and they share every part here:
 * - filters: `DropdownMenuSubTrigger` rows with a `DropdownMenuValue`
 *   ("Repository · All repositories ›"), a separator, a disabled "Clear filters"
 * - account: a `DropdownMenuHeader` with the e-mail, icon rows with submenus for
 *   appearance and language, and a `variant="destructive"` "Log out"
 * - model: a `DropdownMenuLabel` eyebrow ("CLAUDE CODE"), two-line
 *   `DropdownMenuRadioItem`s with a `description`, an Effort submenu row
 */
const ITEM_CLASSES =
  "group/dropdown-menu-item relative flex w-full cursor-default items-center gap-2.5 rounded-sm px-2.5 py-2 text-operate text-fg outline-hidden select-none transition-colors duration-instant data-highlighted:bg-hover-surface data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.75 [&>svg]:text-fg-subtle";

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

const POPUP_CLASSES =
  'z-50 max-h-(--available-height) min-w-[200px] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md bg-popover p-1 text-fg shadow-popover outline-none transition-[opacity,transform] duration-fast ease-out data-starting-style:translate-y-1 data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:translate-y-1 data-ending-style:scale-[0.98] data-ending-style:opacity-0';

function DropdownMenuContent({
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 6,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(POPUP_CLASSES, className)}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

/** The 11px uppercase eyebrow over a group ("CLAUDE CODE"). */
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn('eyebrow px-2.5 pt-2.5 pb-1 data-inset:pl-9.5', className)}
      {...props}
    />
  );
}

/**
 * The non-interactive line that answers "which account is this?" before you
 * act: the e-mail at 12.5px muted, divided from the items by a hairline.
 */
function DropdownMenuHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dropdown-menu-header"
      className={cn(
        '-mx-1 -mt-1 mb-1 truncate border-b border-border-subtle px-3.5 pt-3 pb-2.5 text-[12.5px] text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        ITEM_CLASSES,
        'data-inset:pl-9.5 data-[variant=destructive]:text-danger data-[variant=destructive]:data-highlighted:bg-danger-surface data-[variant=destructive]:[&>svg]:text-danger',
        className,
      )}
      {...props}
    />
  );
}

/** The facet's current value, right-aligned before the submenu chevron. */
function DropdownMenuValue({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-value"
      className={cn('ml-auto truncate text-sm text-fg', className)}
      {...props}
    />
  );
}

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(ITEM_CLASSES, 'data-inset:pl-9.5 data-popup-open:bg-hover-surface', className)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="-mr-1 size-3! text-fg-subtle" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({
  align = 'start',
  alignOffset = -4,
  side = 'right',
  sideOffset = 4,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn('min-w-[160px]', className)}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: MenuPrimitive.CheckboxItem.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(ITEM_CLASSES, 'pr-8 data-inset:pl-9.5', className)}
      checked={checked}
      {...props}
    >
      {children}
      <span className="pointer-events-none absolute right-2.5 flex items-center justify-center text-link">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="size-3.5!" strokeWidth={2.5} />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

/**
 * The two shapes a two-line choice row is drawn in.
 *
 * `default` is the console's menus, which hang off the sidebar and the account
 * button. `compact` is the composer's: it hangs off a 30px button in a foot row
 * and the export draws it a size down throughout — 5px of padding, a 13px label
 * over an 11.5px line, a 16px glyph, the check on that first line, and a right
 * gutter the width of the tick rather than of a menu's.
 *
 * It is a density on the row rather than a class list in `PermissionMenu`
 * because every one of those numbers is *this row* in another size, and the
 * last time they lived in the consumer, the indicator's offset had to be
 * reached through a slot selector to keep up.
 */
type DropdownMenuDensity = 'default' | 'compact';

const RADIO_DENSITY: Record<DropdownMenuDensity, string> = {
  default: 'pr-8 [&_[data-slot=radio-description]]:text-[12.5px]',
  compact:
    'py-[5px] pr-7 text-[13px] [&_[data-slot=radio-description]]:text-[11.5px] [&_[data-slot=radio-description]]:leading-[1.47]',
};

const RADIO_ICON: Record<DropdownMenuDensity, string> = {
  default: '[&_svg:not([class*=size-])]:size-3.75',
  compact: '[&_svg:not([class*=size-])]:size-4',
};

/** Where the check sits: on the first line, which is the row's own top padding. */
const RADIO_INDICATOR: Record<DropdownMenuDensity, string> = {
  default: 'top-2',
  compact: 'top-[5px]',
};

/**
 * A choice row. With `description` it becomes the two-line option (name,
 * then a muted line), the check aligned to the first line. `icon` is the mark
 * before the text, sized by the density; `tone="warning"` colours the whole
 * row, label and description, for the one choice that changes a machine
 * unattended.
 */
function DropdownMenuRadioItem({
  className,
  children,
  density = 'default',
  description,
  icon,
  tone,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean;
  density?: DropdownMenuDensity;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'default' | 'warning';
}) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      data-tone={tone}
      data-density={density}
      className={cn(
        ITEM_CLASSES,
        'items-start data-inset:pl-9.5',
        RADIO_DENSITY[density],
        tone === 'warning' && 'text-warning [&_[data-slot=radio-description]]:text-warning',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className={cn('flex shrink-0 pt-px', RADIO_ICON[density])}>{icon}</span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-px text-left">
        <span className="truncate">{children}</span>
        {description ? (
          <span data-slot="radio-description" className="leading-snug text-fg-muted">
            {description}
          </span>
        ) : null}
      </span>
      <span
        data-slot="radio-indicator"
        className={cn(
          'pointer-events-none absolute right-2.5 flex h-[1.4em] items-center text-link',
          RADIO_INDICATOR[density],
        )}
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon className="size-3.5!" strokeWidth={2.5} />
        </MenuPrimitive.RadioItemIndicator>
      </span>
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('-mx-1 my-1 h-px bg-border-subtle', className)}
      {...props}
    />
  );
}

/**
 * A row that leads into a pane inside the same menu — the account menu's
 * Appearance and Language, the row menu's Move to project… — rather than a
 * submenu beside it: an icon, the label, the current `value` right-aligned,
 * a chevron. It does not close the menu; the caller swaps the content for
 * the pane, whose first row is a `DropdownMenuBack`.
 */
function DropdownMenuPaneItem({
  className,
  value,
  children,
  ...props
}: MenuPrimitive.Item.Props & { value?: React.ReactNode }) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-pane-item"
      closeOnClick={false}
      className={cn(ITEM_CLASSES, className)}
      {...props}
    >
      {children}
      {value !== undefined ? <DropdownMenuValue>{value}</DropdownMenuValue> : null}
      <ChevronRightIcon className={cn('size-3! text-fg-subtle', value === undefined && 'ml-auto')} />
    </MenuPrimitive.Item>
  );
}

/** The first row of a pane: a left chevron and the pane's name, back to the root. */
function DropdownMenuBack({ className, children, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-back"
      closeOnClick={false}
      className={cn(ITEM_CLASSES, 'text-fg-muted', className)}
      {...props}
    >
      <ChevronLeftIcon className="size-3! text-fg-subtle" />
      {children}
    </MenuPrimitive.Item>
  );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn('ml-auto text-xs tracking-normal text-fg-subtle', className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuBack,
  DropdownMenuPaneItem,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuValue,
};
