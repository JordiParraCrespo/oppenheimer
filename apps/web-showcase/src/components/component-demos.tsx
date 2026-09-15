"use client";

import { Badge } from "@oppenheimer/design-system-web/badge";
import { Button } from "@oppenheimer/design-system-web/button";
import { AppIcon } from "@oppenheimer/design-system-web/app-icon";
import {
  Approval,
  ApprovalActions,
  ApprovalDescription,
  ApprovalDetail,
  ApprovalDetails,
  ApprovalHeader,
  ApprovalIcon,
  ApprovalOutcome,
  type ApprovalStatus,
  ApprovalTitle,
} from "@oppenheimer/design-system-web/approval";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@oppenheimer/design-system-web/chart";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandList,
} from "@oppenheimer/design-system-web/command";
import { Composer } from "@oppenheimer/design-system-web/composer";
import { DeltaText } from "@oppenheimer/design-system-web/delta-text";
import {
  ToolCall,
  ToolCallContent,
  ToolCallIcon,
  ToolCallIndicator,
  ToolCallLabel,
  ToolCallPayload,
  ToolCallSummary,
  ToolCallTrigger,
} from "@oppenheimer/design-system-web/tool-call";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHero,
  DialogTitle,
  DialogTrigger,
} from "@oppenheimer/design-system-web/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@oppenheimer/design-system-web/dropdown-menu";
import { Kbd } from "@oppenheimer/design-system-web/kbd";
import { SelectMenu } from "@oppenheimer/design-system-web/select-menu";
import { Switch } from "@oppenheimer/design-system-web/switch";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@oppenheimer/design-system-web/toggle-group";
import {
  BarChart2Icon,
  GlobeIcon,
  LayoutDashboardIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ShieldAlertIcon,
  SparklesIcon,
  Trash2Icon,
  TrendingUpIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

/* ── Forms ──────────────────────────────────────────────────────────────── */

function DropdownDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Row actions">
            <MoreHorizontalIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Lead</DropdownMenuLabel>
        <DropdownMenuItem>View details</DropdownMenuItem>
        <DropdownMenuItem>Assign owner</DropdownMenuItem>
        <DropdownMenuItem>Move stage</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <Trash2Icon />
          Delete lead
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Overlays ───────────────────────────────────────────────────────────── */

/**
 * Three sheet shapes: the plain one, the "install" pattern that leads with the
 * app plates being connected, and the tall one whose middle scrolls. All are
 * the same 16px-radius sheet on a dimmed backdrop — one of the few places the
 * flat system allows depth.
 *
 * The `scroll` variant is the one to check after touching dialog layout: the
 * hero and footer must stay put while only the body moves, and the scrollbar
 * must sit inside the card's rounded corners rather than across them.
 */
export function DialogDemo({
  variant = "basic",
}: {
  variant?: "basic" | "install" | "scroll";
}) {
  const install = variant === "install";

  if (variant === "scroll") {
    return (
      <Dialog>
        <DialogTrigger
          render={<Button variant="secondary">Open long dialog</Button>}
        />
        <DialogContent>
          <DialogHero>
            <AppIcon app="slack" size={44} />
          </DialogHero>
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle>Choose channels</DialogTitle>
            <DialogDescription>
              Pick the channels your agents may post in.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            {Array.from({ length: 24 }, (_, index) => (
              <div
                key={`channel-${index}`}
                className="flex items-center justify-between border-border-subtle border-b pb-3 last:border-b-0"
              >
                <span className="text-base">#channel-{index + 1}</span>
                <Switch defaultChecked={index < 3} />
              </div>
            ))}
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button className="w-full">Save</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="secondary">
            {install ? <PlusIcon /> : null}
            {install ? "Connect app" : "Open dialog"}
          </Button>
        }
      />
      <DialogContent>
        {install ? (
          <DialogHero className="mb-2">
            <AppIcon app="slack" size={44} />
            <AppIcon app="googlechrome" size={44} />
          </DialogHero>
        ) : null}
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle>
            {install ? "Install Oppenheimer for Slack" : "Share this document"}
          </DialogTitle>
          <DialogDescription>
            {install
              ? "Collaborate with your agents directly from Slack."
              : "Anyone with the link in your org can view."}
          </DialogDescription>
        </DialogHeader>
        {install ? null : (
          <div className="flex items-center justify-between border-y border-border-subtle py-3">
            <span className="text-base">Allow comments</span>
            <Switch defaultChecked />
          </div>
        )}
        <DialogFooter>
          <DialogClose
            render={
              <Button className="w-full">
                {install ? "Connect" : "Publish"}
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PALETTE_ITEMS = [
  { icon: LayoutDashboardIcon, label: "Dashboard" },
  { icon: UserRoundIcon, label: "Leads" },
  { icon: GlobeIcon, label: "Domains" },
  { icon: UsersIcon, label: "Team" },
  { icon: BarChart2Icon, label: "Analytics" },
];

export function CommandPaletteDemo() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open palette
        <Kbd className="ml-1">⌘K</Kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search or jump to..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {PALETTE_ITEMS.map((item) => (
              <CommandItem
                key={item.label}
                value={item.label}
                onSelect={() => setOpen(false)}
              >
                <CommandItemIcon>
                  <item.icon />
                </CommandItemIcon>
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem value="Ask AI" onSelect={() => setOpen(false)}>
              <CommandItemIcon>
                <SparklesIcon />
              </CommandItemIcon>
              <span>Ask AI</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

/* ── Data ───────────────────────────────────────────────────────────────── */

const CHART_DATA = [
  { month: "Jan", leads: 240, previous: 180 },
  { month: "Feb", leads: 268, previous: 200 },
  { month: "Mar", leads: 255, previous: 210 },
  { month: "Apr", leads: 300, previous: 232 },
  { month: "May", leads: 330, previous: 250 },
  { month: "Jun", leads: 315, previous: 268 },
  { month: "Jul", leads: 360, previous: 288 },
  { month: "Aug", leads: 399, previous: 300 },
];

const CHART_CONFIG = {
  leads: { label: "Leads", color: "var(--data-line)" },
  previous: { label: "Previous period", color: "var(--data-line-compare)" },
} satisfies ChartConfig;

export function ChartDemo() {
  return (
    <div className="w-full">
      <ChartContainer config={CHART_CONFIG} className="h-60 w-full">
        <LineChart data={CHART_DATA} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--data-grid)" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            className="text-xs"
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="previous"
            stroke="var(--color-previous)"
            strokeWidth={1.6}
            strokeDasharray="4 4"
            dot={false}
          />
          <Line
            dataKey="leads"
            stroke="var(--color-leads)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

export function DataCells() {
  const cells: { label: string; node: React.ReactNode }[] = [
    {
      label: "identity",
      node: (
        <span className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent-purple text-xs text-white">
            N
          </span>
          <span className="text-base font-medium text-ink-900">
            Northwind Retail
          </span>
        </span>
      ),
    },
    {
      label: "secondary",
      node: <span className="text-base text-ink-600">Organic search</span>,
    },
    {
      label: "currency",
      node: <span className="text-base tabular-nums">€12,400</span>,
    },
    { label: "delta", node: <DeltaText value={12} caret /> },
    { label: "status", node: <Badge variant="active">Active</Badge> },
    { label: "count", node: <Badge variant="count">6</Badge> },
    { label: "empty", node: <span className="text-base text-ink-400">—</span> },
    { label: "actions", node: <DropdownDemo /> },
  ];

  return (
    <div className="flex w-full flex-wrap gap-7">
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col items-start gap-2.5">
          <div className="flex min-h-10 items-center">{cell.node}</div>
          <span className="text-xs text-ink-400">{cell.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Patterns ───────────────────────────────────────────────────────────── */

export function SegmentedDemo() {
  return (
    <div className="flex flex-wrap gap-6">
      <ToggleGroup defaultValue={["week"]} multiple={false}>
        <ToggleGroupItem value="day">Day</ToggleGroupItem>
        <ToggleGroupItem value="week">Week</ToggleGroupItem>
        <ToggleGroupItem value="month">Month</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup defaultValue={["all"]} multiple={false}>
        <ToggleGroupItem value="all">All leads</ToggleGroupItem>
        <ToggleGroupItem value="mine">Mine</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

/* ── Navigation ─────────────────────────────────────────────────────────── */

const NAV = [
  { icon: LayoutDashboardIcon, label: "Dashboard", count: undefined },
  { icon: UsersIcon, label: "Team", count: 4 },
  { icon: GlobeIcon, label: "Domains", count: 5 },
  { icon: UserRoundIcon, label: "Leads", count: 6 },
];

export function NavItems() {
  const [active, setActive] = React.useState("Leads");

  return (
    <div className="w-60 space-y-px">
      {NAV.map((item) => {
        const isActive = active === item.label;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => setActive(item.label)}
            className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-base transition-colors ${
              isActive
                ? "bg-surface-sunken font-medium text-ink-900"
                : "text-ink-600 hover:bg-surface-hover hover:text-ink-900"
            }`}
          >
            <item.icon className="size-3.5 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.count != null ? (
              isActive ? (
                <Badge variant="count">{item.count}</Badge>
              ) : (
                <span className="text-xs text-ink-400">{item.count}</span>
              )
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ── Assistant ──────────────────────────────────────────────────────────── */

const MODELS = ["Fast", "Balanced", "Deep reasoning"];

export function ComposerDemo() {
  // Seeded so the specimen shows the send button live — the reference draws
  // it blue, which the real component only does with something to send.
  const [value, setValue] = React.useState(
    "Which leads moved stage this week?",
  );
  const [model, setModel] = React.useState("Balanced");

  return (
    <div className="w-full max-w-lg">
      <Composer
        value={value}
        onValueChange={setValue}
        onSubmit={() => setValue("")}
        placeholder="Ask about a lead, domain or ranking…"
        toolbar={
          <SelectMenu
            variant="ghost"
            value={model}
            options={MODELS}
            onValueChange={setModel}
            icon={<SparklesIcon />}
            width={200}
          />
        }
      />
    </div>
  );
}

/* ── Tool call ──────────────────────────────────────────────────────────── */

export function ToolCallDemo() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-2">
      <ToolCall status="running">
        <ToolCallTrigger>
          <ToolCallIcon>
            <GlobeIcon />
          </ToolCallIcon>
          <ToolCallLabel>domains_list</ToolCallLabel>
          <ToolCallSummary>owner: Marta</ToolCallSummary>
          <ToolCallIndicator />
        </ToolCallTrigger>
        <ToolCallContent>
          <ToolCallPayload>{`{ "owner": "marta@adrirodrigo.es", "limit": 25 }`}</ToolCallPayload>
        </ToolCallContent>
      </ToolCall>

      <ToolCall status="complete" defaultOpen>
        <ToolCallTrigger>
          <ToolCallIcon>
            <TrendingUpIcon />
          </ToolCallIcon>
          <ToolCallLabel>seo_overview</ToolCallLabel>
          <ToolCallSummary>3 domains · 28 days</ToolCallSummary>
          <ToolCallIndicator />
        </ToolCallTrigger>
        <ToolCallContent>
          <ToolCallPayload>{`{\n  "adrirodrigo.es": { "clicks": 4180, "delta": "+12%" },\n  "blog.adrirodrigo.es": { "clicks": 910, "delta": "-31%" }\n}`}</ToolCallPayload>
        </ToolCallContent>
      </ToolCall>

      <ToolCall status="error">
        <ToolCallTrigger>
          <ToolCallIcon>
            <UsersIcon />
          </ToolCallIcon>
          <ToolCallLabel>members_remove</ToolCallLabel>
          <ToolCallSummary>Forbidden</ToolCallSummary>
          <ToolCallIndicator />
        </ToolCallTrigger>
        <ToolCallContent>
          The credential does not hold <code>members:write</code>.
        </ToolCallContent>
      </ToolCall>
    </div>
  );
}

/* ── Approval ───────────────────────────────────────────────────────────── */

export function ApprovalDemo() {
  const [status, setStatus] = React.useState<ApprovalStatus>("pending");

  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <Approval status={status}>
        <ApprovalHeader>
          <ApprovalIcon>
            <ShieldAlertIcon />
          </ApprovalIcon>
          <div className="min-w-0 flex-1">
            <ApprovalTitle>Pause 3 domains</ApprovalTitle>
            <ApprovalDescription>domains_set_status</ApprovalDescription>
          </div>
        </ApprovalHeader>
        <ApprovalDetails>
          <ApprovalDetail label="Domains">
            adrirodrigo.es, blog.adrirodrigo.es, tienda.adrirodrigo.es
          </ApprovalDetail>
          <ApprovalDetail label="Status">paused</ApprovalDetail>
          <ApprovalDetail label="Reverses">Yes — set them back to active</ApprovalDetail>
        </ApprovalDetails>
        {status === "pending" ? (
          <ApprovalActions>
            <Button size="sm" onClick={() => setStatus("approved")}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus("rejected")}
            >
              Reject
            </Button>
          </ApprovalActions>
        ) : (
          <ApprovalActions>
            <ApprovalOutcome>
              {status === "approved"
                ? "Approved."
                : "Rejected — nothing was changed."}
            </ApprovalOutcome>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setStatus("pending")}
            >
              Reset
            </Button>
          </ApprovalActions>
        )}
      </Approval>

      <Approval status="expired">
        <ApprovalHeader>
          <ApprovalIcon>
            <ShieldAlertIcon />
          </ApprovalIcon>
          <div className="min-w-0 flex-1">
            <ApprovalTitle>Export 412 leads</ApprovalTitle>
            <ApprovalDescription>leads_export</ApprovalDescription>
          </div>
        </ApprovalHeader>
        <ApprovalOutcome>Expired without an answer.</ApprovalOutcome>
      </Approval>
    </div>
  );
}
