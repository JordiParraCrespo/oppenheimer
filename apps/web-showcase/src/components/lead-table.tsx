"use client";

import {
  Avatar,
  AvatarFallback,
  type AvatarGradient,
} from "@oppenheimer/design-system-web/avatar";
import { Button } from "@oppenheimer/design-system-web/button";
import { Card } from "@oppenheimer/design-system-web/card";
import { Checkbox } from "@oppenheimer/design-system-web/checkbox";
import { IconButton } from "@oppenheimer/design-system-web/icon-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@oppenheimer/design-system-web/popover";
import { SearchInput } from "@oppenheimer/design-system-web/search-input";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FilterIcon,
  GlobeIcon,
  MoreHorizontalIcon,
  PlusIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";
import { ScoreCell, SourceCell, StageTag } from "@/components/data-cells";

/**
 * The one table pattern used across the product. Team, Domains and Leads all
 * render this: a toolbar that swaps to a bulk-action bar once rows are
 * selected, sortable headers, a facet filter popover, a per-row menu, and a
 * pagination footer.
 *
 * Laid out with flex rows rather than a `<table>`: columns carry explicit
 * pixel widths and the whole thing scrolls horizontally as one unit, which a
 * real table's auto-layout fights.
 */

type Lead = {
  name: string;
  email: string;
  phone: string;
  company: string;
  source: string;
  domain: string;
  stage: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost";
  value: string;
  score: number;
  owner: string;
  grad: AvatarGradient;
  ownerGrad: AvatarGradient;
};

const LEADS: Lead[] = [
  {
    name: "Dana Whitfield",
    email: "dana@northwind.co",
    phone: "+34 611 204 883",
    company: "Northwind Studio",
    source: "Organic search",
    domain: "oppenheimer.dev",
    stage: "Won",
    value: "€24,000",
    score: 92,
    owner: "Iker Sanz",
    grad: "purple",
    ownerGrad: "purple",
  },
  {
    name: "Marcus Lee",
    email: "m.lee@brightpath.io",
    phone: "+34 622 771 049",
    company: "Brightpath",
    source: "Contact form",
    domain: "app.oppenheimer.dev",
    stage: "Qualified",
    value: "€12,400",
    score: 88,
    owner: "Lucía Ferrer",
    grad: "blue",
    ownerGrad: "pink",
  },
  {
    name: "Priya Nair",
    email: "priya@meridian.es",
    phone: "+34 633 118 552",
    company: "Meridian Group",
    source: "Referral",
    domain: "oppenheimer.dev",
    stage: "Contacted",
    value: "€8,150",
    score: 74,
    owner: "Marc Oliver",
    grad: "teal",
    ownerGrad: "blue",
  },
  {
    name: "Tomás Rivera",
    email: "tomas@vegalog.com",
    phone: "+34 644 903 217",
    company: "Vega Logistics",
    source: "LinkedIn",
    domain: "blog.oppenheimer.dev",
    stage: "New",
    value: "€3,600",
    score: 46,
    owner: "Nadia Khan",
    grad: "pink",
    ownerGrad: "teal",
  },
  {
    name: "Amara Okafor",
    email: "amara@atlasmfg.com",
    phone: "+34 655 442 108",
    company: "Atlas Manufacturing",
    source: "Email campaign",
    domain: "oppenheimer.dev",
    stage: "Proposal",
    value: "€21,900",
    score: 95,
    owner: "Iker Sanz",
    grad: "blue",
    ownerGrad: "purple",
  },
  {
    name: "Harbour Legal",
    email: "ops@harbourlegal.es",
    phone: "+34 666 210 774",
    company: "Harbour Legal",
    source: "Phone call",
    domain: "docs.oppenheimer.dev",
    stage: "Lost",
    value: "€2,100",
    score: 31,
    owner: "Lucía Ferrer",
    grad: "teal",
    ownerGrad: "pink",
  },
];

type Column = {
  key: string;
  label: string;
  width: number;
  align?: "right";
  render: (lead: Lead) => React.ReactNode;
};

const COLUMNS: Column[] = [
  {
    key: "name",
    label: "Name",
    width: 200,
    render: (r) => (
      <span className="flex min-w-0 items-center gap-3">
        <Avatar size={30} className="shrink-0">
          <AvatarFallback gradient={r.grad}>{r.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="truncate font-medium">{r.name}</span>
      </span>
    ),
  },
  {
    key: "email",
    label: "Email",
    width: 190,
    render: (r) => (
      <span className="block max-w-[172px] truncate text-ink-600">
        {r.email}
      </span>
    ),
  },
  {
    key: "phone",
    label: "Phone",
    width: 150,
    render: (r) => (
      <span className="whitespace-nowrap text-ink-600">{r.phone}</span>
    ),
  },
  {
    key: "company",
    label: "Company",
    width: 160,
    render: (r) => (
      <span className="block max-w-[142px] truncate text-ink-600">
        {r.company}
      </span>
    ),
  },
  {
    key: "source",
    label: "Source",
    width: 160,
    render: (r) => <SourceCell source={r.source} />,
  },
  {
    key: "domain",
    label: "Domain",
    width: 175,
    render: (r) => (
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-ink-600">
        <GlobeIcon className="size-3.5 text-ink-400" />
        {r.domain}
      </span>
    ),
  },
  {
    key: "stage",
    label: "Stage",
    width: 125,
    render: (r) => <StageTag stage={r.stage} />,
  },
  {
    key: "value",
    label: "Value",
    width: 105,
    align: "right",
    render: (r) => <span className="font-medium">{r.value}</span>,
  },
  {
    key: "score",
    label: "Score",
    width: 110,
    render: (r) => <ScoreCell score={r.score} />,
  },
  {
    key: "owner",
    label: "Owner",
    width: 165,
    render: (r) => (
      <span className="flex min-w-0 items-center gap-2">
        <Avatar size={24} className="shrink-0">
          <AvatarFallback gradient={r.ownerGrad}>
            {r.owner.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate text-ink-600">{r.owner}</span>
      </span>
    ),
  },
];

const SORTABLE = new Set(["name", "company", "stage", "value"]);

const STAGE_FACETS = [
  { value: "New", dot: "bg-status-draft" },
  { value: "Contacted", dot: "bg-status-paused" },
  { value: "Qualified", dot: "bg-status-active" },
  { value: "Lost", dot: "bg-status-ended" },
];

const PAGE_SIZE = 4;

function numeric(value: string) {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
}

export function LeadTable() {
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [sort, setSort] = React.useState<{ key: string | null; dir: 1 | -1 }>({
    key: null,
    dir: 1,
  });
  const [facets, setFacets] = React.useState<Set<string>>(() => new Set());

  const filtered = LEADS.filter((lead) => {
    if (facets.size && !facets.has(lead.stage)) return false;
    if (!query) return true;
    const term = query.toLowerCase();
    return [lead.name, lead.company, lead.email, lead.stage].some((field) =>
      field.toLowerCase().includes(term),
    );
  });

  const sorted = sort.key
    ? [...filtered].sort((a, b) => {
        const x = String(a[sort.key as keyof Lead]);
        const y = String(b[sort.key as keyof Lead]);
        const nx = numeric(x);
        const ny = numeric(y);
        const cmp = nx !== null && ny !== null ? nx - ny : x.localeCompare(y);
        return cmp * sort.dir;
      })
    : filtered;

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = sorted.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE,
  );
  const start = sorted.length ? current * PAGE_SIZE + 1 : 0;
  const end = Math.min(current * PAGE_SIZE + PAGE_SIZE, sorted.length);

  const shownKeys = shown.map((lead) => lead.email);
  const allOn =
    shownKeys.length > 0 && shownKeys.every((key) => selected.has(key));

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      for (const key of shownKeys) {
        if (allOn) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  function toggleOne(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSort(key: string) {
    setSort((current) =>
      current.key === key
        ? { key, dir: -current.dir as 1 | -1 }
        : { key, dir: 1 },
    );
  }

  const count = selected.size;

  return (
    <Card className="w-full gap-0 overflow-hidden p-0">
      {/* Toolbar — becomes the bulk-action bar once anything is selected. */}
      <div
        className={`flex min-h-15 flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3 transition-colors ${
          count ? "bg-surface-sunken" : ""
        }`}
      >
        {count ? (
          <>
            <div className="mr-auto flex items-center gap-2.5">
              <Checkbox checked onClick={() => setSelected(new Set())} />
              <span className="text-base font-medium">{count} selected</span>
            </div>
            <Button variant="secondary">
              <DownloadIcon />
              Export
            </Button>
            <Button variant="secondary">
              <TagIcon />
              Tag
            </Button>
            <Button variant="ghost">
              <Trash2Icon />
              Delete
            </Button>
          </>
        ) : (
          <>
            <SearchInput
              hint={null}
              containerClassName="w-70"
              placeholder="Search leads…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
            <div className="ml-auto flex items-center gap-2">
              <StageFilter
                selected={facets}
                onToggle={(value) => {
                  setFacets((current) => {
                    const next = new Set(current);
                    if (next.has(value)) next.delete(value);
                    else next.add(value);
                    return next;
                  });
                  setPage(0);
                }}
              />
              <Button>
                <PlusIcon />
                Add lead
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Body */}
      <div className="px-1">
        {shown.length ? (
          <div className="scrollbar-thin overflow-x-auto">
            <div className="w-max min-w-full">
              <div className="flex items-center gap-4 border-b border-border-subtle px-3 py-2.5">
                <span className="flex w-11 shrink-0">
                  <Checkbox checked={allOn} onClick={toggleAll} />
                </span>
                {COLUMNS.map((column) => {
                  const on = sort.key === column.key;
                  const SortIcon = on
                    ? sort.dir > 0
                      ? ArrowUpIcon
                      : ArrowDownIcon
                    : ArrowUpDownIcon;
                  return (
                    <span
                      key={column.key}
                      className={`flex min-w-0 text-sm text-ink-400 ${column.align === "right" ? "justify-end" : ""}`}
                      style={{ flex: `0 0 ${column.width}px` }}
                    >
                      {SORTABLE.has(column.key) ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className={`inline-flex items-center gap-1 select-none ${on ? "text-ink-900" : ""}`}
                        >
                          {column.label}
                          <SortIcon
                            className={`size-3 ${on ? "text-ink-900" : "text-ink-400"}`}
                          />
                        </button>
                      ) : (
                        column.label
                      )}
                    </span>
                  );
                })}
                <span className="w-11 shrink-0" />
              </div>

              {shown.map((lead) => (
                <div
                  key={lead.email}
                  className="flex items-center gap-4 border-b border-border-subtle px-3 py-3.5 transition-colors hover:bg-surface-hover"
                >
                  <span className="flex w-11 shrink-0">
                    <Checkbox
                      checked={selected.has(lead.email)}
                      onClick={() => toggleOne(lead.email)}
                    />
                  </span>
                  {COLUMNS.map((column) => (
                    <span
                      key={column.key}
                      className={`flex min-w-0 truncate text-base text-ink-900 ${column.align === "right" ? "justify-end" : ""}`}
                      style={{ flex: `0 0 ${column.width}px` }}
                    >
                      {column.render(lead)}
                    </span>
                  ))}
                  <span className="flex w-11 shrink-0 justify-end">
                    <RowMenu />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-base text-ink-400">
            No leads match “{query}”
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-nowrap items-center gap-3 px-4 py-3 whitespace-nowrap">
        <span className="mr-auto text-sm text-ink-400">
          {start}–{end} of {filtered.length}
        </span>
        <span className="text-sm text-ink-600">
          Page {current + 1} of {pages}
        </span>
        <IconButton
          variant="outline"
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
          aria-label="Previous page"
        >
          <ChevronLeftIcon />
        </IconButton>
        <IconButton
          variant="outline"
          disabled={current >= pages - 1}
          onClick={() => setPage(current + 1)}
          aria-label="Next page"
        >
          <ChevronRightIcon />
        </IconButton>
      </div>
    </Card>
  );
}

function StageFilter({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="secondary">
            <FilterIcon />
            Stage{selected.size ? ` · ${selected.size}` : ""}
            <ChevronDownIcon />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-44 p-1.5">
        {STAGE_FACETS.map((facet) => (
          <button
            key={facet.value}
            type="button"
            onClick={() => onToggle(facet.value)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
          >
            <Checkbox checked={selected.has(facet.value)} tabIndex={-1} />
            <span className={`size-2.5 shrink-0 rounded-full ${facet.dot}`} />
            <span className="flex-1 text-base text-ink-900">{facet.value}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const ROW_ACTIONS = ["View lead", "Assign owner", "Move stage", "Delete"];

function RowMenu() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <IconButton variant="ghost" aria-label="Row actions">
            <MoreHorizontalIcon />
          </IconButton>
        }
      />
      <PopoverContent align="end" className="w-45 p-1.5">
        {ROW_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            className={`flex w-full items-center rounded-md px-2.5 py-2 text-left text-base transition-colors hover:bg-surface-hover ${
              action === "Delete" ? "text-data-down" : "text-ink-900"
            }`}
          >
            {action}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
