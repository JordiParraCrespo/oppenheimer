import { icons as LUCIDE } from "lucide-react";
import { Swatch } from "@/components/page-shell";

/* ── Colors ──────────────────────────────────────────────────────────────── */

type Chip = { name: string; token: string; hex: string; ring?: boolean };

/**
 * A 128px column: the 56px swatch at 10px radius, the name in secondary size,
 * and the hex in mono. `ring` outlines the pale surfaces that would otherwise
 * disappear against the card behind them.
 */
function ColorChip({ name, token, hex, ring }: Chip) {
  return (
    <div className="w-32">
      <div
        className={`h-14 rounded-[10px] border ${ring ? "border-border-default" : "border-transparent"}`}
        style={{ background: `var(${token})` }}
      />
      <div className="mt-2 text-sm text-ink-900">{name}</div>
      <div className="mono mt-0.5 text-ink-400">{hex}</div>
    </div>
  );
}

const COLOR_GROUPS: [string, Chip[]][] = [
  [
    "Inks",
    [
      { name: "Ink 900", token: "--ink-900", hex: "#292929" },
      { name: "Ink 600", token: "--ink-600", hex: "#5D5D5D" },
      { name: "Ink 400", token: "--ink-400", hex: "#9E9E9E" },
    ],
  ],
  [
    "Surfaces",
    [
      { name: "Canvas", token: "--surface-canvas", hex: "#F6F5F3", ring: true },
      { name: "Card", token: "--surface-card", hex: "#FFFFFF", ring: true },
      { name: "Sunken", token: "--surface-sunken", hex: "#F1F0EE", ring: true },
      { name: "Inverse", token: "--surface-inverse", hex: "#2A2926" },
    ],
  ],
  [
    "Accents",
    [
      { name: "Blue", token: "--accent-blue", hex: "#2F80F6" },
      { name: "Cyan", token: "--accent-cyan", hex: "#12B5CE" },
      { name: "Pink", token: "--accent-pink", hex: "#EF3A6B" },
      { name: "Purple", token: "--accent-purple", hex: "#7A5CFF" },
    ],
  ],
  [
    "Status",
    [
      { name: "Active", token: "--status-active", hex: "#1F9D57" },
      { name: "Paused", token: "--status-paused", hex: "#C77A16" },
      { name: "Ended", token: "--status-ended", hex: "#E5484D" },
      { name: "Draft", token: "--status-draft", hex: "#2F80F6" },
    ],
  ],
];

export function Colors() {
  return (
    <div className="flex w-full flex-col gap-5.5">
      {COLOR_GROUPS.map(([group, chips]) => (
        <div key={group}>
          <div className="mb-3 text-xs text-ink-400">{group}</div>
          <div className="flex flex-wrap gap-4">
            {chips.map((chip) => (
              <ColorChip key={chip.token} {...chip} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Typography ──────────────────────────────────────────────────────────── */

const TYPE_ROWS: [string, string, number, string][] = [
  ["24px · medium", "var(--text-24)", 500, "Pick up any agent run"],
  ["14px · medium", "var(--text-14)", 500, "New task"],
  [
    "14px · regular",
    "var(--text-14)",
    400,
    "Body and list text sits at fourteen.",
  ],
  [
    "13px · regular",
    "var(--text-13)",
    400,
    "Navigation, meta and secondary labels",
  ],
  ["12px · regular", "var(--text-12)", 400, "Captions, badges and timestamps"],
];

export function Typography() {
  return (
    <div className="flex w-full flex-col gap-4.5">
      {TYPE_ROWS.map(([note, size, weight, sample]) => (
        <div key={note} className="flex items-baseline gap-5">
          <span className="mono w-[130px] flex-none text-ink-400">{note}</span>
          <span
            className="text-ink-900"
            style={{ fontSize: size, fontWeight: weight }}
          >
            {sample}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Radius ──────────────────────────────────────────────────────────────── */

const RADII: [string, string, string][] = [
  ["8px", "--radius-nav", "Nav rows, chips"],
  ["16px", "--radius-card", "Cards, sheets"],
  ["pill", "--radius-pill", "CTAs, toggles"],
];

export function Radii() {
  return (
    <>
      {RADII.map(([value, token, usage]) => (
        <Swatch key={token} label={usage}>
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-15 w-24 border border-border-default bg-surface-card"
              style={{ borderRadius: `var(${token})` }}
            />
            <span className="mono text-ink-600">{value}</span>
          </div>
        </Swatch>
      ))}
    </>
  );
}

/* ── Icons ───────────────────────────────────────────────────────────────── */

/**
 * The Lucide names used across the product. A handful were renamed upstream
 * after the brand kit was written, so those map to their current component.
 */
const RENAMED: Record<string, string> = {
  filter: "Funnel",
  "check-circle": "CircleCheck",
  "more-horizontal": "Ellipsis",
  "more-vertical": "EllipsisVertical",
  "bar-chart-2": "ChartNoAxesColumn",
  "pie-chart": "ChartPie",
  "help-circle": "CircleQuestionMark",
  "alert-triangle": "TriangleAlert",
  "alert-circle": "CircleAlert",
};

export const ICON_NAMES = [
  "layout-dashboard",
  "users",
  "user-round",
  "user-plus",
  "globe",
  "sparkles",
  "inbox",
  "folder",
  "settings",
  "plus",
  "search",
  "bell",
  "menu",
  "filter",
  "arrow-up-down",
  "chevron-right",
  "chevron-left",
  "chevron-down",
  "chevrons-up-down",
  "arrow-up",
  "arrow-down",
  "arrow-up-right",
  "arrow-left",
  "x",
  "check",
  "check-circle",
  "more-horizontal",
  "more-vertical",
  "pencil",
  "trash-2",
  "copy",
  "link",
  "external-link",
  "download",
  "upload",
  "share-2",
  "eye",
  "eye-off",
  "lock",
  "shield-check",
  "log-out",
  "mail",
  "mail-check",
  "send",
  "phone",
  "calendar",
  "clock",
  "map-pin",
  "building-2",
  "briefcase",
  "tag",
  "star",
  "heart",
  "bookmark",
  "flag",
  "zap",
  "activity",
  "trending-up",
  "trending-down",
  "bar-chart-2",
  "pie-chart",
  "target",
  "euro",
  "credit-card",
  "book-open",
  "file-text",
  "clipboard",
  "message-square",
  "message-circle",
  "phone-call",
  "video",
  "mic",
  "bot",
  "cpu",
  "database",
  "server",
  "cloud",
  "refresh-cw",
  "rotate-cw",
  "loader",
  "play",
  "pause",
  "circle-dot",
  "help-circle",
  "info",
  "alert-triangle",
  "alert-circle",
  "bell-off",
  "moon",
  "sun",
  "grid-2x2",
  "list",
  "columns-3",
];

function pascal(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function Icons() {
  return (
    <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5">
      {ICON_NAMES.map((name) => {
        const Glyph =
          LUCIDE[(RENAMED[name] ?? pascal(name)) as keyof typeof LUCIDE];
        if (!Glyph) return null;
        return (
          <div
            key={name}
            title={name}
            className="flex flex-col items-center gap-2 rounded-md border border-border-subtle bg-surface-card px-1.5 py-3.5"
          >
            <Glyph className="size-4.5 text-ink-900" />
            <span className="mono text-center text-[10.5px] leading-[1.25] break-words text-ink-400">
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
