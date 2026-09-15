"use client";

import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
} from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

/**
 * ToolCall — one step an assistant took, folded away by default.
 *
 * The row is the claim ("Listed domains · 5 results"); the panel is the
 * evidence. Both matter: a reader skimming a long answer wants the sequence,
 * and a reader auditing one wants the arguments and the payload. Compose it —
 * the root only carries the status, and each part decides what it renders:
 *
 * ```tsx
 * <ToolCall status="complete">
 *   <ToolCallTrigger>
 *     <ToolCallIcon><GlobeIcon /></ToolCallIcon>
 *     <ToolCallLabel>domains_list</ToolCallLabel>
 *     <ToolCallSummary>5 results</ToolCallSummary>
 *     <ToolCallIndicator />
 *   </ToolCallTrigger>
 *   <ToolCallContent>
 *     <ToolCallPayload>{JSON.stringify(args, null, 2)}</ToolCallPayload>
 *   </ToolCallContent>
 * </ToolCall>
 * ```
 */
type ToolCallStatus = "running" | "complete" | "error";

const ToolCallContext = React.createContext<ToolCallStatus>("complete");

function ToolCall({
  status = "complete",
  className,
  ...props
}: React.ComponentProps<typeof Collapsible> & { status?: ToolCallStatus }) {
  return (
    <ToolCallContext.Provider value={status}>
      <Collapsible
        data-slot="tool-call"
        data-status={status}
        className={cn(
          "w-full overflow-hidden rounded-xl border border-border-subtle bg-card",
          className,
        )}
        {...props}
      />
    </ToolCallContext.Provider>
  );
}

/** The always-visible row. Folds the panel open; carries its own chevron. */
function ToolCallTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CollapsibleTrigger>) {
  return (
    <CollapsibleTrigger
      data-slot="tool-call-trigger"
      className={cn(
        "group/tool-call-trigger flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="size-3.5 shrink-0 text-ink-400 transition-transform group-data-[panel-open]/tool-call-trigger:rotate-180" />
    </CollapsibleTrigger>
  );
}

/** The 24px tile the tool's glyph sits in. */
function ToolCallIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tool-call-icon"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-canvas [&_svg]:size-3.5 [&_svg]:text-ink-600",
        className,
      )}
      {...props}
    />
  );
}

/** The tool's name. Kept as the API writes it — `domains_list`, not "Domains". */
function ToolCallLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tool-call-label"
      className={cn("truncate text-sm font-medium text-ink-900", className)}
      {...props}
    />
  );
}

/** The one-line outcome beside the name: a count, a target, a reason. */
function ToolCallSummary({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tool-call-summary"
      className={cn("min-w-0 flex-1 truncate text-sm text-ink-400", className)}
      {...props}
    />
  );
}

/**
 * The status glyph, read from the root: a spinner while the call is in flight,
 * a tick when it lands, a warning when it fails. Silent by default — pass
 * children to label it for a reader who cannot tell three small marks apart.
 */
function ToolCallIndicator({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  const status = React.useContext(ToolCallContext);

  return (
    <span
      data-slot="tool-call-indicator"
      data-status={status}
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-xs",
        status === "error" ? "text-status-ended" : "text-ink-400",
        className,
      )}
      {...props}
    >
      {status === "running" ? (
        <Loader2Icon className="size-3.5 animate-spin" />
      ) : status === "error" ? (
        <AlertTriangleIcon className="size-3.5" />
      ) : (
        <CheckIcon className="size-3.5 text-status-active" />
      )}
      {children}
    </span>
  );
}

/** The panel: arguments, the returned payload, whatever the step is evidence of. */
function ToolCallContent({
  className,
  ...props
}: React.ComponentProps<typeof CollapsibleContent>) {
  return (
    <CollapsibleContent
      data-slot="tool-call-content"
      className={cn(
        "flex flex-col gap-2 border-t border-border-subtle px-3 py-2.5 text-sm text-ink-600",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A serialized blob inside the panel. Scrolls in itself and caps its height:
 * a tool that returns two hundred rows must not push the answer off screen.
 */
function ToolCallPayload({ className, ...props }: React.ComponentProps<"pre">) {
  return (
    <pre
      data-slot="tool-call-payload"
      className={cn(
        "max-h-60 overflow-auto rounded-lg bg-surface-sunken p-2.5 font-mono text-xs leading-normal text-ink-600 scrollbar-thin",
        className,
      )}
      {...props}
    />
  );
}

export type { ToolCallStatus };
export {
  ToolCall,
  ToolCallContent,
  ToolCallIcon,
  ToolCallIndicator,
  ToolCallLabel,
  ToolCallPayload,
  ToolCallSummary,
  ToolCallTrigger,
};
