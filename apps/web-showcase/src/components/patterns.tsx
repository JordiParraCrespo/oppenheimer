"use client";

import { Badge } from "@oppenheimer/design-system-web/badge";
import { Card } from "@oppenheimer/design-system-web/card";
import { RecentItem } from "@oppenheimer/design-system-web/recent-item";
import { Stepper } from "@oppenheimer/design-system-web/stepper";
import {
  ArrowUpRightIcon,
  BookOpenIcon,
  FolderIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  SparklesIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import * as React from "react";

/* ── Tabs ───────────────────────────────────────────────────────────────── */

const TABS = [
  { value: "members", label: "Members", count: "5" },
  { value: "roles", label: "Roles", count: "6" },
];

/**
 * The underline tab strip — a hairline rule with a 2px blue indicator on the
 * active tab and a count beside each label. Distinct from the pill `Tabs`:
 * this one splits a *page*, so it reads as structure rather than a control.
 */
export function UnderlineTabs() {
  const [active, setActive] = React.useState("members");

  return (
    <div className="w-full">
      <div className="flex gap-6.5 border-b border-border-subtle">
        {TABS.map((tab) => {
          const on = active === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActive(tab.value)}
              className={`relative inline-flex items-center gap-2 pb-3 text-base ${
                on ? "font-medium text-ink-900" : "text-ink-400"
              }`}
            >
              {tab.label}
              <span className="text-xs text-ink-400">{tab.count}</span>
              {on ? (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-sm bg-accent-blue" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Segmented control ──────────────────────────────────────────────────── */

/** A 2–3 option switch on the sunken track; the active option takes the dark pill. */
export function Segmented() {
  const [value, setValue] = React.useState("View");

  return (
    <div className="inline-flex rounded-full border border-border-subtle bg-surface-sunken p-0.5">
      {["None", "View", "Edit"].map((option) => {
        const on = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setValue(option)}
            className={`rounded-full px-3 py-1 text-sm ${
              on
                ? "bg-primary font-medium text-primary-foreground"
                : "text-ink-600"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

/* ── Stage stepper ──────────────────────────────────────────────────────── */

const STAGES = [
  { value: "New", label: "New" },
  { value: "Contacted", label: "Contacted" },
  { value: "Qualified", label: "Qualified" },
  { value: "Proposal", label: "Proposal" },
  { value: "Won", label: "Won", tone: "won" as const },
];

export function StepperDemo() {
  const [stage, setStage] = React.useState("Qualified");
  return (
    <div className="w-full max-w-[440px]">
      <Stepper steps={STAGES} value={stage} onValueChange={setStage} />
    </div>
  );
}

/* ── Navigation ─────────────────────────────────────────────────────────── */

/**
 * A sidebar row outside the `Sidebar` shell — the same 8×10 padding, 14px icon
 * and 8px radius, with a trailing slot for a count, a run spinner or an
 * external-link arrow.
 */
function NavItem({
  icon: Icon,
  label,
  active = false,
  trailing,
  loading = false,
  external = false,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  trailing?: React.ReactNode;
  loading?: boolean;
  external?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-base transition-colors ${
        active
          ? "bg-surface-sunken font-medium text-ink-900"
          : "text-ink-600 hover:bg-surface-hover"
      }`}
    >
      <Icon
        className={`size-3.5 shrink-0 ${active ? "text-ink-900" : "text-ink-600"}`}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {loading ? (
        <span className="size-3 shrink-0 animate-spin rounded-full border-[1.6px] border-black/12 border-t-ink-400" />
      ) : external ? (
        <ArrowUpRightIcon className="size-3.5 text-ink-400" />
      ) : (
        trailing
      )}
    </button>
  );
}

export function NavItems() {
  return (
    <Card className="w-65 gap-0 p-2">
      <NavItem icon={LayoutDashboardIcon} label="Dashboard" active />
      <NavItem
        icon={UsersIcon}
        label="Team"
        trailing={<span className="text-xs text-ink-400">4</span>}
      />
      <NavItem
        icon={UserRoundIcon}
        label="Leads"
        trailing={<Badge variant="count">6</Badge>}
      />
      <NavItem icon={SparklesIcon} label="Agents" loading />
      <NavItem icon={BookOpenIcon} label="Docs" external />
    </Card>
  );
}

export function Recents() {
  return (
    <Card className="w-65 gap-0 p-2">
      <RecentItem label="Q3 lead scoring" active />
      <RecentItem label="Enrich Meridian list" />
      <RecentItem label="Domain health check" />
    </Card>
  );
}

/** The quiet group header that separates sidebar sections. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 py-1.5 text-sm text-ink-400">{children}</div>;
}

export function SectionLabels() {
  return (
    <Card className="w-65 gap-0 p-2">
      <SectionLabel>Workspace</SectionLabel>
      <NavItem icon={FolderIcon} label="Sales pipeline" />
      <SectionLabel>Recents</SectionLabel>
      <RecentItem label="Follow-up sequence" active />
    </Card>
  );
}
