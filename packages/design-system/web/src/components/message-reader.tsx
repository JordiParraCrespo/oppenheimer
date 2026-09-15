"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ChevronRightIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * The reading pane's contents: subject, who sent it, the body, whatever came
 * attached, and any record the message is linked to.
 *
 * Only the contents. The panel around them — the pager, the archive and delete
 * controls, the close button — is a `Sheet`, because a mail reader is the same
 * overlay as every other detail panel in the workspace and should behave like
 * one.
 */
function MessageReader({
  className,
  ...props
}: React.ComponentProps<"article">) {
  return (
    <article data-slot="message-reader" className={cn(className)} {...props} />
  );
}

/** Subject and sender, ruled off from the body below. */
function MessageReaderHeader({
  className,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="message-reader-header"
      className={cn(
        "mb-[18px] border-b border-border-subtle pt-0.5 pb-[18px]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The subject line — the panel's heading, and the thing `Sheet` should be
 * labelled by. Pass `render={<SheetTitle />}` so it names the dialog without
 * a second heading being added for the accessibility tree.
 */
function MessageReaderSubject({
  className,
  render,
  ...props
}: useRender.ComponentProps<"h1">) {
  return useRender({
    defaultTagName: "h1",
    props: mergeProps<"h1">(
      {
        className: cn(
          "mb-3 text-2xl leading-tight font-medium text-ink-900 text-pretty",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "message-reader-subject" },
  });
}

/** The row under the subject: avatar, identity, mailbox tag, time. */
function MessageReaderMeta({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-reader-meta"
      // Wraps rather than squeezing: the mailbox tag carries a full address
      // and the panel is not always wide enough for four things on one line.
      className={cn(
        "flex flex-wrap items-center gap-x-[11px] gap-y-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Sender name over their address. Both truncate — a long address is still
 * recognisable from its start — and the block keeps a floor width so that a
 * wide mailbox tag beside it wraps the row rather than crushing the name to
 * two letters.
 */
function MessageReaderIdentity({
  name,
  address,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  name: React.ReactNode;
  address?: React.ReactNode;
}) {
  return (
    <div
      data-slot="message-reader-identity"
      className={cn("min-w-32 flex-1", className)}
      {...props}
    >
      <div className="truncate text-base font-medium text-ink-900">{name}</div>
      {address ? (
        <div className="mt-0.5 truncate text-xs text-ink-400">{address}</div>
      ) : null}
    </div>
  );
}

/**
 * The message body. Paragraphs are spaced by the container, so the caller can
 * map over the message's own paragraphs without styling each one — and the
 * spacing stays the same whether the body arrives as an array or as one block
 * of pre-wrapped text.
 */
function MessageReaderBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-reader-body"
      className={cn(
        "text-base leading-[1.6] text-ink-900 [&>p:last-child]:mb-0 [&>p]:mb-3.5",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A file that came with the message: type icon, name, size, and room on the
 * right for the download control.
 *
 * Distinct from `Attachment`, which is the composer's upload tile — that one
 * is a fixed-width card with a media thumbnail and an upload state. This is a
 * full-width row on a received message, and it is never mid-upload.
 */
function MessageAttachment({
  icon,
  name,
  size,
  action,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode;
  name: React.ReactNode;
  size?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="message-attachment"
      className={cn(
        "mt-3.5 flex items-center gap-2.5 rounded-md border border-border-subtle px-3 py-2.5 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
        {name}
      </span>
      {size ? (
        <span className="flex-none text-xs text-ink-400">{size}</span>
      ) : null}
      {action}
    </div>
  );
}

/**
 * The row tying a message to a record elsewhere in the workspace — the lead it
 * came from, most often.
 *
 * Takes `render` so the caller supplies the router's own link
 * (`render={<Link to="/leads/$leadId" />}`) rather than this package reaching
 * for one: the design system has no router, and hardcoding an `<a>` would cost
 * a full page load on every use.
 */
function MessageReaderLink({
  icon,
  children,
  className,
  render,
  ...props
}: useRender.ComponentProps<"a"> & { icon?: React.ReactNode }) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "mt-4 flex items-center gap-2.5 rounded-md border border-border-subtle px-3.25 py-2.75 transition-colors hover:bg-surface-hover [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.75",
          className,
        ),
        children: (
          <>
            {icon}
            <span className="min-w-0 flex-1 truncate text-sm text-ink-600">
              {children}
            </span>
            <ChevronRightIcon className="size-3.5 text-ink-400" />
          </>
        ),
      },
      props,
    ),
    render,
    state: { slot: "message-reader-link" },
  });
}

export {
  MessageAttachment,
  MessageReader,
  MessageReaderBody,
  MessageReaderHeader,
  MessageReaderIdentity,
  MessageReaderLink,
  MessageReaderMeta,
  MessageReaderSubject,
};
