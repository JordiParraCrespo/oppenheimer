"use client";

import { SearchIcon, XIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * MailboxRail — the mail client's left rail: the folder rows at the top, then
 * a filterable tree of every mailbox the workspace owns, grouped by the domain
 * that owns it.
 *
 * A compound rather than one prop-driven component, because the three row
 * shapes are genuinely different — a folder carries an icon, a domain carries
 * a name that truncates, a mailbox carries a purpose dot — and a rail that
 * took one `items` array would have to union all three and branch inside.
 *
 * Every row is a plain `button`: the rail filters the list beside it, it does
 * not navigate, so link semantics would be a lie to a screen reader.
 */
function MailboxRail({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="mailbox-rail"
      className={cn(
        "flex flex-col gap-0.5 overflow-y-auto border-r border-border-subtle px-2.5 py-3",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A folder row — Inbox, Unread, Starred. `count` is dropped when it is zero or
 * `undefined`: an empty folder shows no number rather than a "0", which reads
 * as a broken badge.
 */
function MailboxRailRow({
  icon,
  count,
  active = false,
  children,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  icon?: React.ReactNode;
  count?: number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="mailbox-rail-row"
      data-active={active || undefined}
      aria-pressed={active}
      className={cn(
        "group/rail-row flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left text-sm text-ink-600 transition-colors hover:bg-surface-hover hover:text-ink-900 data-active:bg-surface-sunken data-active:font-medium data-active:text-ink-900 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    >
      <MailboxRailIcon active={active}>{icon}</MailboxRailIcon>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <MailboxRailCount>{count}</MailboxRailCount>
    </button>
  );
}

/** The "Mailboxes" caption that separates the folders from the tree. */
function MailboxRailGroupLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mailbox-rail-group-label"
      className={cn("px-2.5 pt-3.5 pb-1.5 text-xs text-ink-400", className)}
      {...props}
    />
  );
}

/**
 * The rail's own filter field — narrower and quieter than the toolbar's
 * `SearchInput`, because it filters the rail rather than the messages.
 * Controlled; the clear button only mounts once there is something to clear.
 */
function MailboxRailSearch({
  value,
  onValueChange,
  placeholder,
  clearLabel = "Clear",
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  clearLabel?: string;
}) {
  return (
    <div
      data-slot="mailbox-rail-search"
      className={cn(
        "mx-0.5 mb-1.5 flex h-[30px] flex-none items-center gap-[7px] overflow-hidden rounded-md border border-border-default bg-card px-[9px]",
        className,
      )}
    >
      <SearchIcon className="size-3.25 shrink-0 text-ink-400" />
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
        {...props}
      />
      {value ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onValueChange("")}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full hover:bg-surface-hover"
        >
          <XIcon className="size-2.75 text-ink-400" />
        </button>
      ) : null}
    </div>
  );
}

/** Groups a domain header with the mailboxes underneath it. */
function MailboxRailGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mailbox-rail-group"
      className={cn("mt-1.5", className)}
      {...props}
    />
  );
}

/**
 * A domain header. Clicking it selects every mailbox the domain owns, so it is
 * a button in its own right rather than a caption above the rows.
 */
function MailboxRailDomain({
  icon,
  count,
  active = false,
  children,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  icon?: React.ReactNode;
  count?: number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="mailbox-rail-domain"
      data-active={active || undefined}
      aria-pressed={active}
      className={cn(
        "group/rail-domain flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-ink-600 transition-colors hover:bg-surface-hover hover:text-ink-900 data-active:bg-surface-sunken data-active:text-ink-900 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      {...props}
    >
      <MailboxRailIcon active={active}>{icon}</MailboxRailIcon>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <MailboxRailCount>{count}</MailboxRailCount>
    </button>
  );
}

/**
 * A mailbox row, indented under its domain. `tone` is the purpose colour —
 * sales green, support amber — carried by the dot so the rail reads by role
 * as well as by name.
 */
function MailboxRailItem({
  tone,
  count,
  active = false,
  children,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  tone?: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="mailbox-rail-item"
      data-active={active || undefined}
      aria-pressed={active}
      className={cn(
        "group/rail-item flex w-full items-center gap-[9px] rounded-md py-1.5 pr-2.5 pl-[22px] text-left text-sm text-ink-600 transition-colors hover:bg-surface-hover hover:text-ink-900 data-active:bg-surface-sunken data-active:font-medium data-active:text-ink-900",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="size-[7px] shrink-0 rounded-full bg-ink-400"
        style={tone ? { background: tone } : undefined}
      />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <MailboxRailCount>{count}</MailboxRailCount>
    </button>
  );
}

/** "No mailbox matches …" — the rail's own empty state, not the message list's. */
function MailboxRailEmpty({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="mailbox-rail-empty"
      className={cn("px-2.5 py-3.5 text-xs text-ink-400", className)}
      {...props}
    />
  );
}

/**
 * Internal — a row's leading icon. The brand's icon tones are their own scale:
 * a muted glyph beside secondary ink, a strong one on the active row. Reading
 * the row's own colour instead would tint every icon one step too dark.
 */
function MailboxRailIcon({ active, children }: { active: boolean; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <span className={cn("inline-flex flex-none", active ? "text-ink-900" : "text-ink-400")}>
      {children}
    </span>
  );
}

/**
 * Internal — the unread tally every row shares. Not exported: a count outside
 * a rail row has no shape of its own, and exporting it would invite one.
 */
function MailboxRailCount({ children }: { children?: number }) {
  if (!children) return null;
  return (
    <span className="shrink-0 text-xs text-ink-400 group-data-active/rail-row:text-ink-600">
      {children}
    </span>
  );
}

export {
  MailboxRail,
  MailboxRailDomain,
  MailboxRailEmpty,
  MailboxRailGroup,
  MailboxRailGroupLabel,
  MailboxRailItem,
  MailboxRailRow,
  MailboxRailSearch,
};
