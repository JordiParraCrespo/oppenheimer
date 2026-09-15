import type * as React from "react";

import { cn } from "../lib/utils";
import { AppIcon } from "./app-icon";
import { Avatar, AvatarFallback, type AvatarGradient } from "./avatar";

/**
 * The aurora gradients — the only imagery the brand uses. Soft, blurred pastel
 * blends; they appear as agent-card headers and app-store hero strips, never as
 * a page background.
 */
const AGENT_GRADIENTS = {
  blueLilac: "linear-gradient(120deg, #A7C7FF 0%, #C9B8FF 55%, #9FD3FF 100%)",
  peachYellow: "linear-gradient(120deg, #FFC1A6 0%, #FFB0C8 35%, #FFD98A 100%)",
  pinkCoral: "linear-gradient(120deg, #FFB6D9 0%, #FFC0A8 60%, #FFDFA0 100%)",
  tealGreen: "linear-gradient(120deg, #7FE3D0 0%, #7CC6F0 55%, #8BE0A0 100%)",
} as const;

type AgentGradient = keyof typeof AGENT_GRADIENTS;

/**
 * AgentCard — the marketplace card: a gradient header carrying floating white
 * app plates, then a white body with the title, a one-line description and the
 * maker credit.
 */
function AgentCard({
  title,
  description,
  apps = [],
  author,
  authorGradient = "purple",
  gradient = "blueLilac",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  title: string;
  description?: string;
  apps?: string[];
  author?: string;
  /** The maker's avatar ramp — independent of the card's aurora header. */
  authorGradient?: AvatarGradient;
  gradient?: AgentGradient;
}) {
  return (
    <div
      data-slot="agent-card"
      className={cn(
        "w-full max-w-[300px] overflow-hidden rounded-2xl border border-border-default bg-card transition-colors hover:border-border-strong",
        className,
      )}
      {...props}
    >
      <div
        className="flex h-32 items-center justify-center gap-3"
        style={{ background: AGENT_GRADIENTS[gradient] }}
      >
        {apps.map((app) => (
          <AppIcon key={app} app={app} size={44} />
        ))}
      </div>
      <div className="p-4.5">
        <div className="text-base font-medium text-ink-900">{title}</div>
        {description ? (
          <div className="mt-1 text-sm text-ink-400">{description}</div>
        ) : null}
        {author ? (
          <div className="mt-4 flex items-center gap-1.5">
            <span className="text-sm text-ink-400">by</span>
            <Avatar size={20}>
              <AvatarFallback gradient={authorGradient}>
                {author.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-ink-900">{author}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { AGENT_GRADIENTS, AgentCard };
export type { AgentGradient };
