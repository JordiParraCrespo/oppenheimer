"use client";

import { Command as CommandPrimitive } from "cmdk";
import { CornerDownLeftIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-2xl bg-popover p-1 text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn(
          "top-[14vh] translate-y-0 gap-0 overflow-hidden rounded-2xl! p-0 shadow-modal sm:max-w-[560px]",
          className,
        )}
        showCloseButton={showCloseButton}
      >
        {/* The children are CommandInput/List/Item, which read cmdk's context —
            without this wrapper they throw on mount. */}
        <Command className="rounded-none p-0">{children}</Command>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The palette's search row. Its default chrome is dialog chrome — a full-bleed
 * field over a hairline, with an `esc` badge — because that is what ⌘K is.
 *
 * A `Command` inside a popover wants neither: `esc` closes a dialog, and a
 * 280px menu reads better with the field inset. `wrapperClassName` restyles
 * the row and `hint={null}` drops the badge, mirroring how `Alert` takes
 * `icon={null}`. Both default to the dialog's look, so ⌘K is untouched.
 */
function CommandInput({
  className,
  wrapperClassName,
  hint,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  wrapperClassName?: string;
  hint?: React.ReactNode | null;
}) {
  return (
    <div
      data-slot="command-input-wrapper"
      className={cn(
        "flex items-center gap-3 border-b border-border-subtle px-4 py-4",
        wrapperClassName,
      )}
    >
      <SearchIcon className="size-4 shrink-0 text-ink-400" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "w-full bg-transparent text-base text-ink-900 outline-hidden placeholder:text-ink-400 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      {hint === null
        ? null
        : (hint ?? (
            <kbd className="shrink-0 rounded-[6px] bg-surface-sunken px-2 py-1 text-[11px] text-ink-400">
              esc
            </kbd>
          ))}
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "no-scrollbar max-h-[301px] scroll-py-1 overflow-x-hidden overflow-y-auto p-2 outline-none",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden text-foreground **:[[cmdk-group-heading]]:px-2.5 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:text-ink-400",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("my-1.5 h-px bg-border/50", className)}
      {...props}
    />
  );
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-3 rounded-md px-2.5 py-3 text-base outline-hidden select-none in-data-[slot=dialog-content]:rounded-md data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-surface-hover data-[selected=true]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[selected=true]:*:[svg]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <CornerDownLeftIcon className="ml-auto size-3.5 text-ink-400 opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[selected=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  );
}

/**
 * The plate a palette row's icon sits on — a white tile with a hairline, so the
 * icon stays legible once the row takes its selected tint.
 */
function CommandItemIcon({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-item-icon"
      className={cn(
        "inline-flex size-6.5 shrink-0 items-center justify-center rounded-[7px] border border-border-subtle bg-card [&_svg]:size-4!",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-data-[selected=true]/command-item:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
