"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { AGENT_GRADIENTS, type AgentGradient } from "./agent-card";
import { Button } from "./button";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-scrim duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The dialog card.
 *
 * It is a **flex column that does not scroll itself**, capped at the viewport.
 * A tall dialog puts its middle section in a `DialogBody`, which is the only
 * part that scrolls — the hero, header and footer stay put.
 *
 * Scrolling the card itself is what the `has-[…dialog-body]` rule below turns
 * off, and the reason it exists: a scrollbar on the popup is painted inside the
 * padding box, so it cut across the rounded top-right corner and shaved ~15px
 * off the content box — which is exactly the width `DialogHero`'s `-mx-6`
 * counts on, so the gradient band stopped short of the edge and left a grey
 * gutter beside it. A dialog with no body keeps `overflow-y-auto` as a
 * fallback, so long content is still reachable rather than silently clipped.
 *
 * Below `SHORT_VIEWPORT` the pinning is given up entirely and the card goes
 * back to scrolling, `DialogBody` along with it. There is a height at which the
 * hero, header and footer alone are taller than the cap — a phone in landscape,
 * a desktop window at 400% zoom — and pinned regions that do not fit leave the
 * body nothing to shrink into: it collapses to nothing and takes the form
 * fields with it, behind a card that clips. Below the threshold an ugly
 * scrollbar is the better failure.
 */
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "group/dialog fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100svh-4rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 scrollbar-thin overflow-y-auto rounded-2xl border border-border-default bg-popover p-6 text-sm text-popover-foreground duration-100 outline-none [@media(min-height:520px)]:has-[[data-slot=dialog-body]]:overflow-hidden sm:max-w-[460px] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3.5 right-3.5 size-7 rounded-full bg-transparent group-has-[[data-slot=dialog-hero]]/dialog:bg-card/60 group-has-[[data-slot=dialog-hero]]/dialog:text-ink-600 group-has-[[data-slot=dialog-hero]]/dialog:hover:bg-card/85"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

/**
 * DialogHero — the aurora band that opens an install-style dialog: a full-bleed
 * gradient strip carrying floating white plates (`AppIcon` for brand marks,
 * `DialogHeroPlate` for a lucide glyph). Render it as the first child of
 * `DialogContent`; the header below it centres itself and the close button
 * switches to a frosted plate so it reads over the gradient.
 */
function DialogHero({
  gradient = "blueLilac",
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  gradient?: AgentGradient;
}) {
  return (
    <div
      data-slot="dialog-hero"
      className={cn(
        "-mx-6 -mt-6 flex h-28 shrink-0 items-center justify-center gap-3 rounded-t-[15px]",
        className,
      )}
      style={{ background: AGENT_GRADIENTS[gradient], ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * DialogHeroPlate — the white floating tile a lucide icon sits on inside a
 * `DialogHero`, matching the plate `AppIcon` renders for brand marks.
 */
function DialogHeroPlate({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dialog-hero-plate"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl bg-card text-ink-600 [&_svg]:size-5",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex shrink-0 flex-col gap-1.5 group-has-[[data-slot=dialog-hero]]/dialog:items-center group-has-[[data-slot=dialog-hero]]/dialog:text-center",
        className,
      )}
      {...props}
    />
  );
}

/**
 * DialogBody — the one scrolling region of a tall dialog.
 *
 * Put the middle of the dialog in it (the form fields, the long list) and leave
 * the hero, header and footer as siblings: they stay pinned while this scrolls,
 * so the submit buttons never walk off the bottom of the screen.
 *
 * `flex-auto` rather than `flex-1`: `flex-1` sets a `0%` basis, which makes the
 * card measure the body as zero-height and collapse it, since the card sizes to
 * its content up to `max-h`. `min-h-0` is what lets it shrink past its content
 * once the cap is hit — without it the body refuses to shrink and the footer
 * gets pushed out of view instead.
 *
 * The negative margin cancels the card's padding so the scrollbar rides the
 * card's edge, while `px-6` puts the content back where it was — and leaves
 * room for a focus ring, which a bare scroll container clips. `scrollbar-thin`
 * is the same 8px bar the product's other in-card panes use; the default 15px
 * one reads as chrome the flat system does not otherwise have.
 *
 * Under 520px of viewport height it stops being a scroll region at all
 * (`min-h-fit`, visible overflow) and the card scrolls instead — the two
 * breakpoints are complements of each other, and the reason is in
 * `DialogContent` above. Nothing between them: a body that keeps `min-h-0`
 * while the card clips is a body that collapses to zero.
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "-mx-6 min-h-0 flex-auto scrollbar-thin overflow-y-auto overscroll-contain px-6 [@media(max-height:519.98px)]:min-h-fit [@media(max-height:519.98px)]:overflow-visible",
        className,
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("cn-font-heading text-2xl font-medium", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-base text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHero,
  DialogHeroPlate,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
