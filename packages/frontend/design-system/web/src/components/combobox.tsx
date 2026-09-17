"use client";

import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { selectTriggerVariants } from "./select";

type ComboboxOption = {
  value: string;
  label: string;
  /** A second line under the label — searched as well as shown. */
  meta?: string;
  /** Rendered before the label, in both the row and the trigger. */
  icon?: React.ReactNode;
};

/** Rows rendered at a time; more are added as the list nears its end. */
const PAGE_SIZE = 50;
const LOAD_MORE_THRESHOLD = 40;
/** Matches `AsyncMultiSelect`: long enough to skip a word, short enough to feel live. */
const DEBOUNCE_MS = 180;

/**
 * Combobox — the *form* control for picking one value out of a list nobody
 * wants to scroll: teammates, tracked domains, anything whose length is a
 * property of the workspace rather than of the product. It wears
 * `selectTriggerVariants`, so it sits on the same control ladder as `Input`
 * and `Select` and lines up with them on a form row; what it adds is a search
 * box over the options.
 *
 * Distinct from its neighbours, which are each the right answer somewhere else:
 *
 * - `Select` — a fixed, short, product-defined list (a stage, a source). Its
 *   options are known at build time and a search box over eight of them is
 *   furniture.
 * - `SelectMenu` / `FilterMenu` — toolbar chrome, not a labelled field.
 * - `AsyncMultiSelect` — several values out of thousands. This one picks
 *   exactly one, and reads as a field rather than as a filter chip.
 *
 * `value` is `null` for "nothing picked". Pass `clearLabel` to offer that as a
 * row — "Unassigned", "No domain" — which is also what the trigger then reads
 * when the value is null; without it the trigger shows `placeholder`.
 *
 * **Two ways to search.** With no `onQueryChange`, the query filters `options`
 * here, which is right when the caller already holds every option. Pass
 * `onQueryChange` and the query is yours to answer — debounced, so a keystroke
 * is not a request — and `options` is taken as the answer and shown unfiltered.
 * Narrowing the fetch that way does not blank the trigger: the picked option is
 * remembered even once a query pushes it out of the list.
 *
 * Rows are windowed at 50 and extended on scroll, so a workspace with two
 * thousand domains does not mount two thousand rows.
 *
 * Controlled: own `value` and handle `onValueChange`.
 */
function Combobox({
  options,
  value,
  onValueChange,
  onQueryChange,
  loading,
  id,
  placeholder,
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  loadingText = "Searching…",
  clearLabel,
  disabled,
  invalid,
  size,
  className,
  contentClassName,
}: {
  options: ComboboxOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  /**
   * Called with the typed query, debounced. Its presence means the caller is
   * fetching the options, so they are rendered as given rather than filtered
   * again here — a second filter would drop rows the server matched on a field
   * this control never sees.
   */
  onQueryChange?: (query: string) => void;
  /** Shown in place of the list while a query has no options to draw yet. */
  loading?: boolean;
  /** Points `FieldLabel`'s `htmlFor` at the trigger. */
  id?: string;
  /** Trigger text with nothing picked — ignored when `clearLabel` is given. */
  placeholder?: string;
  searchPlaceholder?: string;
  /** Shown in place of the list when the query matches nothing. */
  emptyText?: string;
  loadingText?: string;
  /** Label of the row that sets the value back to `null`. */
  clearLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const listId = React.useId();
  const listRef = React.useRef<HTMLDivElement>(null);

  const term = query.trim().toLowerCase();

  // Debounced, and only while open: a control the reader has closed should not
  // still be asking the API about the query they left in it.
  React.useEffect(() => {
    if (!onQueryChange) return;
    const timer = setTimeout(() => onQueryChange(open ? query.trim() : ""), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [onQueryChange, open, query]);

  const matches = React.useMemo(() => {
    if (onQueryChange || !term) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) ||
        (option.meta ?? "").toLowerCase().includes(term),
    );
  }, [onQueryChange, options, term]);

  /**
   * The clear row is a row like any other for the keyboard, so it has to be in
   * the same array the arrow keys walk. It is dropped once a query is typed:
   * "Unassigned" is not an answer to a search for a name.
   */
  const rows = React.useMemo<(ComboboxOption | null)[]>(
    () => (clearLabel && !term ? [null, ...matches] : matches),
    [clearLabel, matches, term],
  );

  const visible = rows.slice(0, limit);

  /**
   * The picked option, kept across a narrowing of `options`. A caller fetching
   * per query has a list that no longer contains the pick as soon as the reader
   * types something else, and a trigger that empties itself mid-search reads as
   * having lost the answer.
   */
  const found = value === null ? null : (options.find((option) => option.value === value) ?? null);
  const remembered = React.useRef<ComboboxOption | null>(null);
  if (found && remembered.current?.value !== found.value) remembered.current = found;
  const selected =
    found ?? (value !== null && remembered.current?.value === value ? remembered.current : null);

  function choose(option: ComboboxOption | null) {
    onValueChange(option ? option.value : null);
    setOpen(false);
    setQuery("");
  }

  function move(next: number) {
    const index = Math.max(0, Math.min(next, visible.length - 1));
    setActive(index);
    // `nearest` and not `center`: a list that jumps under the cursor on every
    // arrow press is harder to read than one that scrolls a row at a time.
    listRef.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(active - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(visible.length - 1);
    } else if (event.key === "Enter") {
      // Prevented either way: an Enter that falls through submits the form this
      // field sits in, on a dialog the reader was only searching in.
      event.preventDefault();
      // Bounds-checked rather than `?? null`-ed: an index left past the end of
      // a list that shrank under it would otherwise read as the clear row and
      // silently empty the field.
      if (active < visible.length) choose(visible[active] ?? null);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function onScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    if (
      el.scrollTop + el.clientHeight >= el.scrollHeight - LOAD_MORE_THRESHOLD &&
      limit < rows.length
    ) {
      setLimit((current) => current + PAGE_SIZE);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setActive(0);
        setLimit(PAGE_SIZE);
        // The query is per-opening. Keeping it would reopen the control onto a
        // filtered list, with the reason for it two clicks in the past.
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? listId : undefined}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            data-slot="combobox-trigger"
            // The popover's trigger does not carry the select's open-state
            // attribute, and `selectTriggerVariants` draws the focus ring off
            // it — without this the field is the only control on the form that
            // does not light up while its menu is open.
            data-popup-open={open ? "" : undefined}
            data-placeholder={selected || clearLabel ? undefined : ""}
            className={cn(selectTriggerVariants({ size }), "w-full", className)}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
              {selected?.icon}
              <span className="truncate">
                {selected ? selected.label : (clearLabel ?? placeholder)}
              </span>
            </span>
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 text-ink-400 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        }
      />
      <PopoverContent
        align="start"
        data-slot="combobox-content"
        className={cn(
          "w-(--anchor-width) max-w-[calc(100vw-2rem)] min-w-52 overflow-hidden p-0 shadow-menu",
          contentClassName,
        )}
      >
        <div className="flex items-center gap-2.25 border-b border-border-subtle px-3.25 py-2.75">
          <SearchIcon className="size-3.75 shrink-0 text-ink-400" />
          <input
            // biome-ignore lint/a11y/noAutofocus: the field is the reason the popover opened
            autoFocus
            type="text"
            value={query}
            aria-label={searchPlaceholder}
            aria-controls={listId}
            aria-activedescendant={visible.length > 0 ? `${listId}-${active}` : undefined}
            placeholder={searchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setLimit(PAGE_SIZE);
            }}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 bg-transparent text-base text-ink-900 outline-none placeholder:text-ink-400"
          />
        </div>

        <div
          ref={listRef}
          id={listId}
          role="listbox"
          onScroll={onScroll}
          className="max-h-64 overflow-y-auto p-1.5 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-border-default [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-2"
        >
          {visible.length > 0 ? (
            visible.map((option, index) => {
              const on = option ? option.value === value : value === null;
              return (
                <button
                  key={option ? option.value : "__clear__"}
                  type="button"
                  role="option"
                  id={`${listId}-${index}`}
                  data-index={index}
                  aria-selected={on}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-base text-ink-900",
                    index === active && "bg-surface-hover",
                    on && "bg-surface-sunken",
                  )}
                >
                  <span className="flex w-4 shrink-0 items-center">
                    {on ? <CheckIcon className="size-4 text-accent-blue" /> : null}
                  </span>
                  {option?.icon}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {option ? <Highlight text={option.label} term={term} /> : clearLabel}
                    </span>
                    {option?.meta ? (
                      <span className="block truncate text-xs text-ink-400">
                        <Highlight text={option.meta} term={term} />
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-5.5 text-center text-sm text-ink-400">
              {loading ? loadingText : emptyText}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Internal — marks the matched run so the reader can see *why* a row survived
 * the query. The same drawing as `MailboxPicker`'s, and for the same reason.
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

export { Combobox, type ComboboxOption };
