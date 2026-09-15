"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@oppenheimer/design-system-web/dropdown-menu";
import {
  AsyncMultiSelect,
  type AsyncOption,
} from "@oppenheimer/design-system-web/async-multi-select";
import { Button } from "@oppenheimer/design-system-web/button";
import {
  Combobox,
  type ComboboxOption,
} from "@oppenheimer/design-system-web/combobox";
import { Checkbox } from "@oppenheimer/design-system-web/checkbox";
import { Input } from "@oppenheimer/design-system-web/input";
import { Label } from "@oppenheimer/design-system-web/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@oppenheimer/design-system-web/popover";
import {
  RadioGroup,
  RadioGroupItem,
} from "@oppenheimer/design-system-web/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@oppenheimer/design-system-web/select";
import { SelectMenu } from "@oppenheimer/design-system-web/select-menu";
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  FileTextIcon,
  GlobeIcon,
  PencilIcon,
  SearchIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";

/**
 * Field — a 260px column: a 13px secondary-ink label over the control, with
 * 7px between them. Every form control in the inventory sits in one.
 */
function Field({
  label,
  htmlFor,
  width = 260,
  children,
}: {
  label: string;
  htmlFor: string;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ width }}>
      <Label htmlFor={htmlFor} className="mb-2 block">
        {label}
      </Label>
      {children}
    </div>
  );
}

/* ── Text field ─────────────────────────────────────────────────────────── */

export function TextFields() {
  return (
    <>
      <Field label="Small · 28px" htmlFor="tf-sm">
        <Input id="tf-sm" size="sm" placeholder="Compact, for toolbars" />
      </Field>
      <Field label="Default · 36px" htmlFor="tf-name">
        <Input id="tf-name" placeholder="Your full name" />
      </Field>
      <Field label="Large · 44px" htmlFor="tf-lg">
        <Input id="tf-lg" size="lg" placeholder="Prominent single field" />
      </Field>
      <Field label="Filled" htmlFor="tf-email">
        <Input id="tf-email" defaultValue="you@oppenheimer.dev" />
      </Field>
      <Field label="Disabled" htmlFor="tf-disabled">
        <Input id="tf-disabled" defaultValue="Read only" disabled />
      </Field>
    </>
  );
}

/* ── Select ─────────────────────────────────────────────────────────────── */

function LabelledSelect({
  label,
  id,
  options,
}: {
  label: string;
  id: string;
  options: string[];
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Select defaultValue={options[0]}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function Selects() {
  return (
    <>
      <LabelledSelect
        label="Stage"
        id="sel-stage"
        options={["New", "Contacted", "Qualified", "Lost"]}
      />
      <LabelledSelect
        label="Assign to"
        id="sel-owner"
        options={["Lucía Ferrer", "Marc Oliver", "Nadia Khan", "Iker Sanz"]}
      />
    </>
  );
}

/* ── Select menu ────────────────────────────────────────────────────────── */

export function SelectMenus() {
  const [domain, setDomain] = React.useState("All domains");
  const [range, setRange] = React.useState("Last 30 days");

  return (
    <>
      <Swatch label="domain filter">
        <SelectMenu
          value={domain}
          onValueChange={setDomain}
          icon={<GlobeIcon />}
          width={240}
          options={[
            "All domains",
            "oppenheimer.dev",
            "app.oppenheimer.dev",
            "blog.oppenheimer.dev",
            "docs.oppenheimer.dev",
          ]}
        />
      </Swatch>
      <Swatch label="date range">
        <SelectMenu
          value={range}
          onValueChange={setRange}
          icon={<CalendarIcon />}
          width={200}
          options={["Last 7 days", "Last 30 days", "Last 90 days", "This year"]}
        />
      </Swatch>
    </>
  );
}

/* Local copy of the Spec's Swatch so these demos stay self-contained. */
function Swatch({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2.5">
      <div className="flex min-h-10 items-center">{children}</div>
      <span className="text-xs text-ink-400">{label}</span>
    </div>
  );
}

/* ── Autocomplete ───────────────────────────────────────────────────────── */

const DOMAINS = ["oppenheimer.dev", "app.oppenheimer.dev", "blog.oppenheimer.dev"];
const SLUGS = [
  "pricing",
  "contact",
  "services",
  "customers",
  "changelog",
  "docs",
  "guides",
  "integrations",
  "security",
  "careers",
  "blog",
  "about",
  "status",
  "partners",
  "roadmap",
];

/** ~2,400 mock pages — enough that windowing and debouncing actually matter. */
const PAGES: AsyncOption[] = DOMAINS.flatMap((domain) =>
  SLUGS.flatMap((slug, slugIndex) =>
    Array.from({ length: 54 }, (_, n) => {
      const path = `/${slug}${n === 0 ? "" : `-${n + 1}`}`;
      return {
        value: `${domain}${path}`,
        label: path,
        meta: `${domain} · ${1200 - n * 7 - slugIndex * 30} clicks/mo`,
      };
    }),
  ),
);

const KEYWORD_BASE = [
  "design system",
  "component library",
  "react components",
  "tailwind tokens",
  "accessible ui",
  "figma to code",
  "dark mode tokens",
  "ui kit react",
];

const KEYWORDS: AsyncOption[] = KEYWORD_BASE.flatMap((base, baseIndex) =>
  Array.from({ length: 40 }, (_, n) => ({
    value: `${base}-${n}`,
    label: n === 0 ? base : `${base} ${n + 1}`,
    meta: `${900 - baseIndex * 40 - n * 3} searches/mo`,
  })),
);

/** Simulates a network round-trip so the debounce and spinner are visible. */
function makeFetcher(source: AsyncOption[]) {
  return (query: string) =>
    new Promise<AsyncOption[]>((resolve) => {
      const term = query.trim().toLowerCase();
      const matches = term
        ? source.filter((option) => option.value.toLowerCase().includes(term))
        : source;
      setTimeout(() => resolve(matches), 220);
    });
}

export function Autocompletes() {
  const [pages, setPages] = React.useState<AsyncOption[]>([]);
  const [keywords, setKeywords] = React.useState<AsyncOption[]>([]);
  const pageFetcher = React.useMemo(() => makeFetcher(PAGES), []);
  const keywordFetcher = React.useMemo(() => makeFetcher(KEYWORDS), []);

  return (
    <>
      <Swatch label={`pages (${PAGES.length.toLocaleString("en-US")})`}>
        <AsyncMultiSelect
          fetcher={pageFetcher}
          selected={pages}
          onSelectedChange={setPages}
          icon={<FileTextIcon />}
          triggerLabel="Filter pages"
          placeholder="Search pages by URL…"
          emptyText="Start typing a URL…"
          width={340}
        />
      </Swatch>
      <Swatch label={`keywords (${KEYWORDS.length})`}>
        <AsyncMultiSelect
          fetcher={keywordFetcher}
          selected={keywords}
          onSelectedChange={setKeywords}
          icon={<SearchIcon />}
          triggerLabel="Keywords"
          placeholder="Search keywords…"
          emptyText="Start typing a keyword…"
          width={300}
        />
      </Swatch>
    </>
  );
}

/* ── Combobox ───────────────────────────────────────────────────────────── */

const TEAMMATES: ComboboxOption[] = [
  { value: "lucia", label: "Lucía Ferrer", meta: "lucia@oppenheimer.dev" },
  { value: "marc", label: "Marc Oliver", meta: "marc@oppenheimer.dev" },
  { value: "nadia", label: "Nadia Khan", meta: "nadia@oppenheimer.dev" },
  { value: "iker", label: "Iker Sanz", meta: "iker@oppenheimer.dev" },
  { value: "paula", label: "Paula Rey", meta: "paula@oppenheimer.dev" },
  { value: "tomas", label: "Tomás Bru", meta: "tomas@oppenheimer.dev" },
];

const SITES: ComboboxOption[] = [
  "asesoriarodrigo.es",
  "kitdigital-galicia.es",
  "clinicadentalvigo.com",
  "reformas-coruna.es",
  "gestoriaourense.com",
  "tallermecanicolugo.es",
].map((hostname) => ({ value: hostname, label: hostname }));

export function Comboboxes() {
  const [owner, setOwner] = React.useState<string | null>(null);
  const [site, setSite] = React.useState<string | null>("asesoriarodrigo.es");

  return (
    <>
      <Field label="Owner" htmlFor="cb-owner">
        <Combobox
          id="cb-owner"
          options={TEAMMATES}
          value={owner}
          onValueChange={setOwner}
          clearLabel="Unassigned"
          searchPlaceholder="Search teammates…"
        />
      </Field>
      <Field label="Domain" htmlFor="cb-domain">
        <Combobox
          id="cb-domain"
          options={SITES}
          value={site}
          onValueChange={setSite}
          clearLabel="No domain"
          searchPlaceholder="Search domains…"
        />
      </Field>
      <Field label="Disabled" htmlFor="cb-disabled">
        <Combobox
          id="cb-disabled"
          options={SITES}
          value={SITES[0].value}
          onValueChange={() => undefined}
          disabled
        />
      </Field>
    </>
  );
}

/* ── Dropdown menu ──────────────────────────────────────────────────────── */

const ACTIONS = [
  { icon: PencilIcon, label: "Rename" },
  { icon: CopyIcon, label: "Duplicate" },
  { icon: Share2Icon, label: "Share" },
  { icon: Trash2Icon, label: "Delete", danger: true },
];

export function ActionsDropdown() {
  const [open, setOpen] = React.useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button variant="secondary">
            Actions
            {open ? (
              <ChevronUpIcon className="ml-0.5 size-3.5" />
            ) : (
              <ChevronDownIcon className="ml-0.5 size-3.5" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        {ACTIONS.map((action) => (
          <DropdownMenuItem
            key={action.label}
            variant={action.danger ? "destructive" : "default"}
          >
            <action.icon />
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Checkbox & radio ───────────────────────────────────────────────────── */

export function Choices() {
  return (
    <>
      <Swatch label="checkbox">
        <div className="flex w-50 flex-col gap-3">
          {[
            ["ch-email", "Email notifications", true],
            ["ch-digest", "Weekly digest", false],
            ["ch-updates", "Product updates", false],
          ].map(([id, label, checked]) => (
            <div key={id as string} className="flex items-center gap-2.5">
              <Checkbox id={id as string} defaultChecked={checked as boolean} />
              <Label htmlFor={id as string} className="text-base text-ink-900">
                {label as string}
              </Label>
            </div>
          ))}
        </div>
      </Swatch>
      <Swatch label="radio">
        <RadioGroup defaultValue="all" className="flex w-50 flex-col gap-3">
          {[
            ["all", "All leads"],
            ["mine", "My leads"],
            ["unassigned", "Unassigned"],
          ].map(([value, label]) => (
            <div key={value} className="flex items-center gap-2.5">
              <RadioGroupItem value={value} id={`rg-${value}`} />
              <Label htmlFor={`rg-${value}`} className="text-base text-ink-900">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </Swatch>
    </>
  );
}

/* ── Filter menus ───────────────────────────────────────────────────────── */

/* Deployment-status colours, which are the platform's own vocabulary rather
   than the brand's four status tokens — hence the literal values. */
const STATUS_OPTIONS = [
  { value: "ready", label: "Ready", dot: "bg-status-active" },
  { value: "error", label: "Error", dot: "bg-status-ended" },
  { value: "building", label: "Building", dot: "bg-status-paused" },
  { value: "queued", label: "Queued", dot: "bg-track-off" },
  { value: "initializing", label: "Initializing", dot: "bg-track-off" },
  { value: "canceled", label: "Canceled", dot: "bg-track-off" },
  { value: "blocked", label: "Blocked", dot: "bg-status-ended" },
];

/**
 * The multi-select status filter: overlapping dots on the trigger, an n/total
 * count, and a "Check all" that only appears on the hovered row.
 */
export function StatusFilter() {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState(
    () =>
      new Set(
        STATUS_OPTIONS.filter((o) => o.value !== "canceled").map(
          (o) => o.value,
        ),
      ),
  );

  function toggle(value: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2.5 rounded-md border border-border-default bg-card px-3.5 transition-colors hover:border-border-strong"
          >
            <span className="inline-flex">
              {STATUS_OPTIONS.slice(0, 3).map((option, index) => (
                <span
                  key={option.value}
                  className={`size-3 rounded-full border-2 border-card ${option.dot} ${index ? "-ml-1" : ""}`}
                />
              ))}
            </span>
            <span className="text-base font-medium text-ink-900">Status</span>
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink-600 tabular-nums">
              {selected.size}/{STATUS_OPTIONS.length}
            </span>
            {open ? (
              <ChevronUpIcon className="size-4 text-ink-900" />
            ) : (
              <ChevronDownIcon className="size-4 text-ink-900" />
            )}
          </button>
        }
      />
      <PopoverContent align="start" className="w-60 p-1.5 shadow-panel">
        {STATUS_OPTIONS.map((option) => (
          <div
            key={option.value}
            className="group/row flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-surface-hover"
            onClick={() => toggle(option.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ")
                toggle(option.value);
            }}
            // biome-ignore lint/a11y/useSemanticElements: the row holds a nested "Check all" button
            role="checkbox"
            aria-checked={selected.has(option.value)}
            tabIndex={0}
          >
            <DarkCheck on={selected.has(option.value)} />
            <span className={`size-2.5 shrink-0 rounded-full ${option.dot}`} />
            <span className="min-w-0 flex-1 truncate text-base text-ink-900">
              {option.label}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setSelected(new Set(STATUS_OPTIONS.map((o) => o.value)));
              }}
              className="hidden shrink-0 text-sm font-medium text-ink-600 group-hover/row:block"
            >
              Check all
            </button>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** The filter's own checkbox: larger and near-black rather than the blue form one. */
function DarkCheck({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex size-4.5 shrink-0 items-center justify-center rounded-[5px] transition-colors ${
        on ? "bg-accent-blue" : "border-[1.5px] border-border-strong"
      }`}
    >
      {on ? (
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
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

/** The single-select counterpart: one active row, marked with a check. */
export function EnvDropdown() {
  const options = ["All environments", "Production", "Preview"];
  const [value, setValue] = React.useState(options[0]);
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={`inline-flex min-w-48 items-center justify-between gap-2.5 h-9 rounded-md border border-border-default px-3.5 text-base font-medium text-ink-900 transition-colors ${
              open ? "bg-surface-sunken" : "bg-card"
            }`}
          >
            {value}
            {open ? (
              <ChevronUpIcon className="size-4 text-ink-900" />
            ) : (
              <ChevronDownIcon className="size-4 text-ink-900" />
            )}
          </button>
        }
      />
      <PopoverContent align="start" className="w-55 p-1.5 shadow-panel">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setValue(option);
              setOpen(false);
            }}
            className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-base text-ink-900 transition-colors hover:bg-surface-hover"
          >
            {option}
            {value === option ? (
              <CheckIcon className="size-4 text-ink-900" />
            ) : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
