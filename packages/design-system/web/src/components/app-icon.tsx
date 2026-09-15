import { CheckIcon, PlusIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";

/**
 * Brand marks come from the Iconify API, per the brand guide. Colourful logos
 * live in the `logos` set; marks that are monochrome by design (X, GitHub,
 * Apple) come from `simple-icons` and get tinted.
 *
 * These are third-party trademarks — use them only to represent a real
 * integration. Pass `src` to serve a mark yourself and skip the network call.
 */
const LOGO_SET: Record<string, string> = {
  slack: "slack-icon",
  zoom: "zoom-icon",
  notion: "notion-icon",
  figma: "figma",
  asana: "asana-icon",
  trello: "trello",
  whatsapp: "whatsapp-icon",
  telegram: "telegram",
  linkedin: "linkedin-icon",
  messenger: "messenger",
  google: "google-icon",
  meta: "meta-icon",
  googlechrome: "chrome",
  googlegemini: "google-gemini",
};

function iconifyUrl(app: string) {
  return LOGO_SET[app]
    ? `https://api.iconify.design/logos/${LOGO_SET[app]}.svg`
    : `https://api.iconify.design/simple-icons/${app}.svg?color=%23292929`;
}

/**
 * AppIcon — a brand logo on a rounded-square tile. `plate` renders the white
 * floating plate used over agent-card gradients; turn it off for a tile that
 * sits on the sunken surface.
 */
function AppIcon({
  app,
  label,
  size = 40,
  plate = true,
  src,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & {
  app: string;
  label?: string;
  size?: number;
  plate?: boolean;
  src?: string;
}) {
  const inner = Math.round(size * 0.5);
  return (
    <span
      data-slot="app-icon"
      title={label ?? app}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl",
        plate ? "bg-card" : "bg-surface-sunken",
        className,
      )}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      {/* biome-ignore lint/performance/noImgElement: third-party marks are remote SVGs, not app assets */}
      <img
        src={src ?? iconifyUrl(app)}
        alt={label ?? app}
        width={inner}
        height={inner}
        className="block"
      />
    </span>
  );
}

/**
 * AppTile — a row in the Apps grid: brand icon, name, one-line description,
 * and a trailing add control that becomes a check once connected.
 */
function AppTile({
  app,
  name,
  description,
  connected = false,
  onAdd,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "onSelect"> & {
  app: string;
  name: string;
  description?: string;
  connected?: boolean;
  onAdd?: () => void;
}) {
  return (
    <div
      data-slot="app-tile"
      className={cn("flex items-center gap-4 px-1 py-3", className)}
      {...props}
    >
      <AppIcon app={app} label={name} size={48} plate={false} />
      <div className="min-w-0 flex-1">
        <div className="text-base font-medium text-ink-900">{name}</div>
        {description ? (
          <div className="truncate text-sm text-ink-400">{description}</div>
        ) : null}
      </div>
      {connected ? (
        <CheckIcon className="mr-2 size-4 text-ink-600" />
      ) : (
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onAdd}
          aria-label={`Connect ${name}`}
          title={`Connect ${name}`}
        >
          <PlusIcon />
        </Button>
      )}
    </div>
  );
}

export { AppIcon, AppTile };
