"use client";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  GlobeIcon,
  MailIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type MailboxOption = {
  /** The full address — the value this control selects by. */
  address: string;
  /** The part before the @, shown as the row's name. */
  local: string;
  /** The part after it; also how the list is grouped. */
  domain: string;
  /** What the mailbox is for ("Sales", "Support") — searched, not displayed. */
  label?: string;
  /** The purpose colour of its dot. */
  tone?: string;
  unread?: number;
};

type MailboxPickerLabels = {
  /** Trigger text with nothing selected. */
  all: string;
  /** Trigger text for a plain multi-selection. */
  count: (count: number) => string;
  searchPlaceholder: string;
  empty: (query: string) => string;
  /** The right-hand link on a domain row, by whether the domain is fully on. */
  selectDomain: string;
  clearDomain: string;
  /** Footer summaries. */
  selectedSummary: (selected: number, total: number) => string;
  totalSummary: (mailboxes: number, domains: number) => string;
  clearAll: string;
  selectAll: string;
  /** Accessible name for the ✕ on the trigger. */
  clearSelection: string;
  clearSearch: string;
};

const DEFAULT_LABELS: MailboxPickerLabels = {
  all: "All inboxes",
  count: (count) => `${count} inboxes`,
  searchPlaceholder: "Search inbox, domain or team…",
  empty: (query) => `No inbox matches “${query}”`,
  selectDomain: "Select all",
  clearDomain: "Clear",
  selectedSummary: (selected, total) => `${selected} of ${total} selected`,
  totalSummary: (mailboxes, domains) =>
    `${mailboxes} inboxes across ${domains} domains`,
  clearAll: "Clear all",
  selectAll: "Select all",
  clearSelection: "Clear inbox filter",
  clearSearch: "Clear",
};

/**
 * MailboxPicker — the mail toolbar's "which inboxes am I looking at" control:
 * a searchable multi-select over every mailbox in the workspace, grouped by
 * the domain that owns it, with the whole domain selectable in one click.
 *
 * Distinct from `AsyncMultiSelect`, which windows thousands of flat options
 * fetched a page at a time. Mailboxes are a known, bounded set with a
 * two-level shape, and the grouping is the point — most selections here are
 * "everything on this domain", which a flat list cannot express in one click.
 *
 * The trigger names the selection by the tightest thing that describes it: one
 * address, a whole domain, or a count. A count where a name would fit makes
 * the reader open the menu to find out what they are looking at.
 *
 * Controlled: own `selected` (addresses) and handle `onSelectedChange`.
 */
function MailboxPicker({
  mailboxes,
  selected,
  onSelectedChange,
  labels: labelOverrides,
  width = 330,
  className,
}: {
  mailboxes: MailboxOption[];
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
  labels?: Partial<MailboxPickerLabels>;
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };

  const selectedSet = React.useMemo(() => new Set(selected), [selected]);
  const term = query.trim().toLowerCase();

  // A query matches the local part, the full address, the domain, or the human
  // label — so "sup", "kitdigital" and "sales" all find something useful.
  const groups = React.useMemo(() => {
    const matched = mailboxes.filter(
      (mailbox) =>
        !term ||
        mailbox.address.toLowerCase().includes(term) ||
        mailbox.domain.toLowerCase().includes(term) ||
        (mailbox.label ?? "").toLowerCase().includes(term),
    );
    const byDomain: { domain: string; boxes: MailboxOption[] }[] = [];
    for (const mailbox of matched) {
      const group = byDomain.find((entry) => entry.domain === mailbox.domain);
      if (group) group.boxes.push(mailbox);
      else byDomain.push({ domain: mailbox.domain, boxes: [mailbox] });
    }
    return byDomain;
  }, [mailboxes, term]);

  // The visible rows in render order — what the arrow keys walk.
  const flat = React.useMemo(
    () => groups.flatMap((group) => group.boxes),
    [groups],
  );

  const domains = React.useMemo(
    () => [...new Set(mailboxes.map((mailbox) => mailbox.domain))],
    [mailboxes],
  );

  /**
   * The domain that exactly accounts for the selection, if there is one — the
   * trigger names it instead of counting. Compared against the full mailbox
   * list, not the filtered one: what is selected does not change when the
   * search box narrows what is shown.
   */
  const wholeDomain = React.useMemo(() => {
    if (selected.length === 0) return undefined;
    return domains.find((domain) => {
      const boxes = mailboxes.filter((mailbox) => mailbox.domain === domain);
      return (
        boxes.length === selected.length &&
        boxes.every((mailbox) => selectedSet.has(mailbox.address))
      );
    });
  }, [domains, mailboxes, selected.length, selectedSet]);

  function toggle(address: string) {
    onSelectedChange(
      selectedSet.has(address)
        ? selected.filter((entry) => entry !== address)
        : [...selected, address],
    );
  }

  function toggleDomain(domain: string) {
    const boxes = mailboxes.filter((mailbox) => mailbox.domain === domain);
    const allOn = boxes.every((mailbox) => selectedSet.has(mailbox.address));
    const addresses = new Set(boxes.map((mailbox) => mailbox.address));
    onSelectedChange(
      allOn
        ? selected.filter((entry) => !addresses.has(entry))
        : [
            ...selected,
            ...boxes
              .filter((b) => !selectedSet.has(b.address))
              .map((b) => b.address),
          ],
    );
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(flat.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = flat[active];
      if (option) toggle(option.address);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const count = selected.length;
  const triggerLabel =
    count === 0
      ? labels.all
      : count === 1
        ? selected[0]
        : (wholeDomain ?? labels.count(count));

  // Walks with render order so the highlight and the arrow keys agree.
  let index = -1;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            data-slot="mailbox-picker-trigger"
            data-active={count > 0 || undefined}
            className={cn(
              "inline-flex h-9 max-w-[200px] shrink-0 items-center gap-2 rounded-full border border-border-default bg-card px-3 text-sm text-ink-900 transition-colors hover:bg-surface-hover data-active:border-accent-blue data-active:bg-focus-ring",
              className,
            )}
          >
            {wholeDomain ? (
              <GlobeIcon
                className={cn(
                  "size-3.75 shrink-0",
                  count ? "text-accent-blue" : "text-ink-400",
                )}
              />
            ) : (
              <MailIcon
                className={cn(
                  "size-3.75 shrink-0",
                  count ? "text-accent-blue" : "text-ink-400",
                )}
              />
            )}
            <span className="min-w-0 truncate">{triggerLabel}</span>
            {count > 1 && !wholeDomain ? (
              <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent-blue px-1.5 text-[11px] font-medium text-white">
                {count}
              </span>
            ) : null}
            {count > 0 ? (
              // A span, not a button: this sits inside the trigger button, and
              // a nested button is invalid markup as well as a second tab stop
              // in the middle of a control.
              <span
                role="button"
                tabIndex={-1}
                aria-label={labels.clearSelection}
                title={labels.clearSelection}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectedChange([]);
                }}
                className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface-hover"
              >
                <XIcon className="size-3 text-ink-400" />
              </span>
            ) : open ? (
              <ChevronUpIcon className="size-3.5 shrink-0 text-ink-400" />
            ) : (
              <ChevronDownIcon className="size-3.5 shrink-0 text-ink-400" />
            )}
          </button>
        }
      />
      <PopoverContent
        align="start"
        data-slot="mailbox-picker-content"
        className="max-w-[calc(100vw-1.75rem)] overflow-hidden p-0 shadow-panel"
        style={{ width }}
      >
        <div className="flex items-center gap-2.25 border-b border-border-subtle px-3.25 py-2.75">
          <SearchIcon className="size-3.75 shrink-0 text-ink-400" />
          <input
            // biome-ignore lint/a11y/noAutofocus: the field is the reason the popover opened
            autoFocus
            value={query}
            placeholder={labels.searchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 bg-transparent text-base text-ink-900 outline-none placeholder:text-ink-400"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActive(0);
              }}
              className="shrink-0 text-xs text-accent-blue hover:opacity-80"
            >
              {labels.clearSearch}
            </button>
          ) : null}
        </div>

        <div className="max-h-74 overflow-y-auto p-1.5 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-border-default [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2">
          {groups.length ? (
            groups.map((group) => {
              const boxes = mailboxes.filter(
                (mailbox) => mailbox.domain === group.domain,
              );
              const allOn = boxes.every((mailbox) =>
                selectedSet.has(mailbox.address),
              );
              return (
                <div key={group.domain}>
                  <button
                    type="button"
                    onClick={() => toggleDomain(group.domain)}
                    className="flex w-full items-center gap-2 rounded-md px-2 pt-2 pb-1.5 text-left text-xs text-ink-400 hover:text-ink-900"
                  >
                    <GlobeIcon className="size-3.25 shrink-0" />
                    <Highlight text={group.domain} term={term} />
                    <span className="ml-auto flex-none text-[11.5px] text-accent-blue">
                      {allOn ? labels.clearDomain : labels.selectDomain}
                    </span>
                  </button>
                  {group.boxes.map((mailbox) => {
                    index += 1;
                    const rowIndex = index;
                    const on = selectedSet.has(mailbox.address);
                    return (
                      <button
                        key={mailbox.address}
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={on}
                        onMouseEnter={() => setActive(rowIndex)}
                        onClick={() => toggle(mailbox.address)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-base text-ink-900",
                          rowIndex === active && "bg-surface-hover",
                        )}
                      >
                        <MailboxCheck checked={on} />
                        <span
                          aria-hidden
                          className="size-[7px] shrink-0 rounded-full bg-ink-400"
                          style={
                            mailbox.tone
                              ? { background: mailbox.tone }
                              : undefined
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">
                          <Highlight text={mailbox.local} term={term} />
                          <span className="text-ink-400">
                            @{mailbox.domain}
                          </span>
                        </span>
                        {mailbox.unread ? (
                          <span className="flex-none text-xs text-ink-400">
                            {mailbox.unread}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          ) : (
            <div className="px-3 py-5.5 text-center text-sm text-ink-400">
              {labels.empty(query)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 border-t border-border-subtle bg-surface-sunken px-3 py-2.25">
          <span className="flex-1 text-xs text-ink-400">
            {count
              ? labels.selectedSummary(count, mailboxes.length)
              : labels.totalSummary(mailboxes.length, domains.length)}
          </span>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => onSelectedChange([])}
            className="text-xs text-accent-blue not-disabled:hover:opacity-80 disabled:cursor-default disabled:text-ink-400 disabled:opacity-60"
          >
            {labels.clearAll}
          </button>
          <button
            type="button"
            onClick={() =>
              onSelectedChange(mailboxes.map((mailbox) => mailbox.address))
            }
            className="text-xs text-accent-blue hover:opacity-80"
          >
            {labels.selectAll}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Internal — marks the matched run inside a name so the reader can see *why* a
 * row survived the query. Highlights the first occurrence only: a second one
 * in the same short string adds noise, not information.
 */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const at = text.toLowerCase().indexOf(term);
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <b className="rounded-[3px] bg-accent-blue/16 font-medium">
        {text.slice(at, at + term.length)}
      </b>
      {text.slice(at + term.length)}
    </>
  );
}

/** Internal — see the note on `FilterMenu`'s copy of this: a drawing, not a control. */
function MailboxCheck({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-[17px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors",
        checked
          ? "border-accent-blue bg-accent-blue"
          : "border-border-strong bg-transparent",
      )}
    >
      {checked ? (
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M2.5 6.2l2.2 2.2 4.8-4.8"
            fill="none"
            stroke="#fff"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

export { MailboxPicker, type MailboxOption, type MailboxPickerLabels };
