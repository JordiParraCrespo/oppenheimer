"use client";

import * as React from "react";

import { cn } from "../lib/utils";

/**
 * Approval — an action the assistant proposed and will not take until somebody
 * says yes.
 *
 * It is a card rather than a sentence on purpose: what is about to happen has
 * to be legible without reading the paragraph above it, which is why the
 * details list is a first-class part and not free prose. The root holds only
 * the status, so a resolved card keeps its shape and swaps its footer:
 *
 * ```tsx
 * <Approval status="pending">
 *   <ApprovalHeader>
 *     <ApprovalIcon><ShieldAlertIcon /></ApprovalIcon>
 *     <div>
 *       <ApprovalTitle>Pause 3 domains</ApprovalTitle>
 *       <ApprovalDescription>domains_set_status</ApprovalDescription>
 *     </div>
 *   </ApprovalHeader>
 *   <ApprovalDetails>
 *     <ApprovalDetail label="Status">paused</ApprovalDetail>
 *   </ApprovalDetails>
 *   <ApprovalActions>…</ApprovalActions>
 * </Approval>
 * ```
 */
type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

const ApprovalContext = React.createContext<ApprovalStatus>("pending");

function Approval({
  status = "pending",
  className,
  ...props
}: React.ComponentProps<"div"> & { status?: ApprovalStatus }) {
  return (
    <ApprovalContext.Provider value={status}>
      <div
        data-slot="approval"
        data-status={status}
        className={cn(
          "flex w-full flex-col gap-3 rounded-2xl border border-border-default bg-card p-3.5",
          // A resolved proposal is history: it stays readable, but it stops
          // competing with the live turn underneath it.
          status !== "pending" && "border-border-subtle bg-surface-canvas",
          className,
        )}
        {...props}
      />
    </ApprovalContext.Provider>
  );
}

function ApprovalHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="approval-header"
      className={cn("flex min-w-0 items-start gap-3", className)}
      {...props}
    />
  );
}

/** The 32px tile the action's glyph sits in. */
function ApprovalIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="approval-icon"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-canvas [&_svg]:size-4 [&_svg]:text-ink-600",
        className,
      )}
      {...props}
    />
  );
}

/** What will happen, in the reader's words — "Pause 3 domains", not a tool name. */
function ApprovalTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="approval-title"
      className={cn("text-base font-medium text-ink-900", className)}
      {...props}
    />
  );
}

/** The tool behind it, or the one line of context the title left out. */
function ApprovalDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="approval-description"
      className={cn("mt-0.5 text-sm text-ink-600", className)}
      {...props}
    />
  );
}

/** The arguments, spelled out. A hairline-separated list, never a JSON blob. */
function ApprovalDetails({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="approval-details"
      className={cn(
        "divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle",
        className,
      )}
      {...props}
    />
  );
}

function ApprovalDetail({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { label: React.ReactNode }) {
  return (
    <div
      data-slot="approval-detail"
      className={cn("flex items-baseline gap-3 px-2.5 py-2", className)}
      {...props}
    >
      <dt className="w-24 shrink-0 text-sm text-ink-400">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-sm text-ink-900">
        {children}
      </dd>
    </div>
  );
}

/** The buttons. Rendered only while the proposal is live — resolve it with `ApprovalOutcome`. */
function ApprovalActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="approval-actions"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}

/**
 * What became of it, once it is no longer pending. Coloured from the root's
 * status so the two can never disagree.
 */
function ApprovalOutcome({ className, ...props }: React.ComponentProps<"p">) {
  const status = React.useContext(ApprovalContext);

  return (
    <p
      data-slot="approval-outcome"
      data-status={status}
      className={cn(
        "text-sm",
        status === "approved"
          ? "text-status-active"
          : status === "rejected"
            ? "text-status-ended"
            : "text-ink-400",
        className,
      )}
      {...props}
    />
  );
}

export type { ApprovalStatus };
export {
  Approval,
  ApprovalActions,
  ApprovalDescription,
  ApprovalDetail,
  ApprovalDetails,
  ApprovalHeader,
  ApprovalIcon,
  ApprovalOutcome,
  ApprovalTitle,
};
