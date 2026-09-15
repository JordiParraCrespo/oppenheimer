"use client";

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import * as React from "react";

import { cn } from "../lib/utils";

/**
 * The brand's avatar gradients — a soft two-stop ramp per accent. Used when
 * there is no image, behind a single white initial.
 */
const AVATAR_GRADIENTS = {
  purple: "linear-gradient(135deg, #9B8CFF 0%, #6C4BFF 100%)",
  blue: "linear-gradient(135deg, #8FB6FF 0%, #4C86F0 100%)",
  teal: "linear-gradient(135deg, #7FE0D4 0%, #17B3C9 100%)",
  pink: "linear-gradient(135deg, #FFA6C4 0%, #EF3A6B 100%)",
} as const;

type AvatarGradient = keyof typeof AVATAR_GRADIENTS;

/**
 * `size` takes the t-shirt scale or a number of pixels. The brand sizes avatars
 * in px because they sit inline with text at whatever the surrounding row needs
 * (20 in a maker credit, 28 in a chat turn, 40 in a specimen).
 */
function Avatar({
  className,
  size = "default",
  style,
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg" | number;
}) {
  const numeric = typeof size === "number";
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={numeric ? undefined : size}
      className={cn(
        "group/avatar relative flex shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken dark:after:mix-blend-lighten",
        !numeric &&
          "size-8 [--avatar-font:13px] data-[size=lg]:size-10 data-[size=lg]:[--avatar-font:17px] data-[size=sm]:size-6 data-[size=sm]:[--avatar-font:10px]",
        className,
      )}
      style={
        numeric
          ? {
              width: size,
              height: size,
              // Published so the fallback can size its initial off the box.
              // Rounded in JS, not scaled in CSS: the brand sizes the initial
              // in whole pixels, floored at 10 so tiny avatars stay legible.
              ...({
                "--avatar-font": `${Math.max(10, Math.round(size * 0.42))}px`,
              } as Record<string, string>),
              ...style,
            }
          : style
      }
      {...props}
    />
  );
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className,
      )}
      {...props}
    />
  );
}

/**
 * With `gradient`, the fallback becomes the brand's initial-on-gradient mark:
 * white, medium, sized at 42% of the avatar so it scales with it.
 */
function AvatarFallback({
  className,
  gradient,
  style,
  ...props
}: AvatarPrimitive.Fallback.Props & { gradient?: AvatarGradient }) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full text-sm group-data-[size=sm]/avatar:text-xs",
        gradient
          ? "font-medium text-white [font-size:var(--avatar-font,13px)]"
          : "bg-muted text-muted-foreground",
        className,
      )}
      style={
        gradient ? { background: AVATAR_GRADIENTS[gradient], ...style } : style
      }
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  AVATAR_GRADIENTS,
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
};
export type { AvatarGradient };
