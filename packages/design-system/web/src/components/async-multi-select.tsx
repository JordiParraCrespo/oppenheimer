"use client";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type AsyncOption = { value: string; label: string; meta?: string };

const DEBOUNCE_MS = 180;
const PAGE_SIZE = 50;
const LOAD_MORE_THRESHOLD = 40;

/**
 * AsyncMultiSelect — the typeahead combobox for high-cardinality fields: pages
 * or keywords numbering in the thousands, where a checkbox filter menu would be
 * unusable.
 *
 * `fetcher(query)` is called debounced and may be genuinely async. Results are
 * windowed — 50 at a time, extending as the list nears its end — so a few
 * thousand options never all mount. Selections pin to the top as chips so they
 * stay visible once the query moves on.
 *
 * Controlled: own `selected` and handle `onSelectedChange`.
 */
function AsyncMultiSelect({
  fetcher,
  selected,
  onSelectedChange,
  icon,
  triggerLabel,
  placeholder = "Search…",
  emptyText = "Type to search",
  width = 340,
  className,
}: {
  fetcher: (query: string) => Promise<AsyncOption[]>;
  selected: AsyncOption[];
  onSelectedChange: (selected: AsyncOption[]) => void;
  icon?: React.ReactNode;
  triggerLabel?: string;
  placeholder?: string;
  emptyText?: string;
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<AsyncOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [limit, setLimit] = React.useState(PAGE_SIZE);

  const selectedValues = React.useMemo(
    () => new Set(selected.map((item) => item.value)),
    [selected],
  );

  // Debounced fetch. The cancel flag matters: a slow earlier request must not
  // overwrite the results of a later, faster one.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const next = await fetcher(query);
      if (cancelled) return;
      setResults(next);
      setLoading(false);
      setActive(0);
      setLimit(PAGE_SIZE);
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, fetcher]);

  function toggle(option: AsyncOption) {
    onSelectedChange(
      selectedValues.has(option.value)
        ? selected.filter((item) => item.value !== option.value)
        : [...selected, option],
    );
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = results[active];
      if (option) toggle(option);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function onScroll(event: React.UIEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    if (
      el.scrollTop + el.clientHeight >= el.scrollHeight - LOAD_MORE_THRESHOLD &&
      limit < results.length
    ) {
      setLimit((value) => value + PAGE_SIZE);
    }
  }

  const shown = results.slice(0, limit);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn("max-w-full justify-start", className)}
            style={{ width }}
          >
            {icon}
            <span className="flex-1 truncate text-left">
              {selected.length
                ? `${triggerLabel ?? "Selected"} · ${selected.length}`
                : (triggerLabel ?? placeholder)}
            </span>
            {open ? (
              <ChevronUpIcon className="size-3.5" />
            ) : (
              <ChevronDownIcon className="size-3.5" />
            )}
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className="max-w-[calc(100vw-2rem)] overflow-hidden p-0 shadow-panel"
        style={{ width }}
      >
        <div className="border-b border-border-subtle p-2.5">
          <div className="flex h-9 items-center gap-2 rounded-md border border-border-default px-2.5">
            <SearchIcon className="size-4 shrink-0 text-ink-400" />
            <input
              // biome-ignore lint/a11y/noAutofocus: the field is the reason the popover opened
              autoFocus
              value={query}
              placeholder={placeholder}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              className="w-full bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
            />
            {loading ? (
              <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-border-default border-t-ink-600" />
            ) : null}
          </div>
        </div>

        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5 pb-1">
            {selected.map((item) => (
              <span
                key={item.value}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border-subtle bg-surface-sunken py-1 pr-1.5 pl-2 text-xs text-ink-900"
              >
                <span className="truncate">{item.label}</span>
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  aria-label={`Remove ${item.label}`}
                  className="inline-flex"
                >
                  <XIcon className="size-3 text-ink-400" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div onScroll={onScroll} className="max-h-66 overflow-y-auto p-1.5">
          {shown.length > 0 ? (
            shown.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => toggle(option)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md p-2 text-left",
                  index === active && "bg-surface-hover",
                )}
              >
                <Checkbox
                  checked={selectedValues.has(option.value)}
                  tabIndex={-1}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base text-ink-900">
                    {option.label}
                  </span>
                  {option.meta ? (
                    <span className="block truncate text-xs text-ink-400">
                      {option.meta}
                    </span>
                  ) : null}
                </span>
              </button>
            ))
          ) : (
            <div className="p-2.5 text-center text-sm text-ink-400">
              {loading ? "Searching…" : emptyText}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle px-3 py-2">
          <span className="text-xs text-ink-400">
            {selected.length} selected
          </span>
          <button
            type="button"
            onClick={() => onSelectedChange([])}
            className="cursor-pointer text-sm text-accent-blue"
          >
            Clear
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { AsyncMultiSelect };
export type { AsyncOption };
