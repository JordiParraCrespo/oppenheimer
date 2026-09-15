"use client";

import { Badge } from "@oppenheimer/design-system-web/badge";
import {
  FileTextIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";

/**
 * The small in-table cells the product assembles rows from. They are patterns
 * rather than design-system components: each is a composition over Badge, an
 * icon and the brand tokens, specific to what a column means.
 */

/** Role colours are per-role identity, not status — hence the raw values. */
const ROLE_COLORS: Record<string, string> = {
  Owner: "var(--status-paused)",
  Admin: "var(--accent-purple)",
  "SEO manager": "var(--accent-blue)",
  Editor: "var(--accent-cyan)",
  Analyst: "var(--status-active)",
  Viewer: "var(--ink-400)",
};

export function RolePill({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-sunken py-1 pr-2.5 pl-2 text-sm whitespace-nowrap text-ink-900">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: ROLE_COLORS[role] ?? "var(--ink-400)" }}
      />
      {role}
    </span>
  );
}

const TEAM_STATUS = {
  active: { variant: "active", label: "Active" },
  away: { variant: "paused", label: "Away" },
  invited: { variant: "draft", label: "Invited" },
} as const;

export function TeamStatus({ status }: { status: keyof typeof TEAM_STATUS }) {
  const { variant, label } = TEAM_STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function ScopeCell({
  scope,
  count = 0,
}: {
  scope: "all" | "some";
  count?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-ink-600">
      <GlobeIcon className="size-3.5 text-ink-400" />
      {scope === "all"
        ? "All domains"
        : `${count} domain${count === 1 ? "" : "s"}`}
    </span>
  );
}

const SOURCES: Record<string, { icon: LucideIcon; color: string }> = {
  "Organic search": { icon: SearchIcon, color: "var(--status-active)" },
  "Contact form": { icon: FileTextIcon, color: "var(--accent-blue)" },
  "Landing page": { icon: LayoutDashboardIcon, color: "var(--accent-purple)" },
  "Phone call": { icon: PhoneIcon, color: "var(--accent-cyan)" },
  WhatsApp: { icon: MessageCircleIcon, color: "var(--status-active)" },
  Referral: { icon: UsersIcon, color: "var(--status-paused)" },
  "Email campaign": { icon: MailIcon, color: "var(--accent-pink)" },
};

export function SourceCell({ source }: { source: string }) {
  const entry = SOURCES[source];
  const Icon = entry?.icon ?? SearchIcon;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-ink-600">
      <Icon
        className="size-3.5"
        style={{ color: entry?.color ?? "var(--ink-400)" }}
      />
      {source}
    </span>
  );
}

/** A 34px meter: green from 80, amber from 50, otherwise tertiary ink. */
export function ScoreCell({ score }: { score: number }) {
  const color =
    score >= 80
      ? "var(--status-active)"
      : score >= 50
        ? "var(--status-paused)"
        : "var(--ink-400)";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="h-1 w-8.5 shrink-0 overflow-hidden rounded-full bg-surface-sunken">
        <span
          className="block h-full rounded-full"
          style={{ width: `${score}%`, background: color }}
        />
      </span>
      <span className="text-sm font-medium">{score}</span>
    </span>
  );
}

const STAGE = {
  New: "draft",
  Contacted: "paused",
  Qualified: "active",
  Proposal: "draft",
  Won: "active",
  Lost: "ended",
} as const;

export function StageTag({ stage }: { stage: keyof typeof STAGE }) {
  return <Badge variant={STAGE[stage]}>{stage}</Badge>;
}
