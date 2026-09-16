'use client';

import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * Avatar — a pill with initials or an image. Three sizes from the system's
 * ramp: sm 22px (sidebar footer, session rows), md 28px, lg 38px. Neutral by
 * default; `accent` is the blue tint used for the signed-in account. No
 * gradients: the system forbids them, and `AVATAR_GRADIENTS` below is kept only
 * so the unported components compile — every entry resolves to the accent tint.
 */
function Avatar({
  className,
  size = 'md',
  variant = 'neutral',
  style,
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: 'sm' | 'md' | 'lg' | 'default' | number;
  variant?: 'neutral' | 'accent';
}) {
  const numeric = typeof size === 'number';
  const named = size === 'default' ? 'md' : size;
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={numeric ? undefined : named}
      data-variant={variant}
      className={cn(
        'group/avatar relative flex shrink-0 items-center justify-center overflow-hidden rounded-pill font-medium tracking-normal uppercase select-none',
        variant === 'accent' ? 'bg-info-surface text-info' : 'bg-control text-fg-muted',
        !numeric &&
          'data-[size=sm]:size-[22px] data-[size=sm]:text-[10px] data-[size=md]:size-7 data-[size=md]:text-[11px] data-[size=lg]:size-[38px] data-[size=lg]:text-sm',
        className,
      )}
      style={
        numeric
          ? { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)), ...style }
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
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  gradient: _gradient,
  ...props
}: AvatarPrimitive.Fallback.Props & { gradient?: AvatarGradient }) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn('flex size-full items-center justify-center leading-none', className)}
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        'absolute right-0 bottom-0 z-10 inline-flex size-2 items-center justify-center rounded-pill bg-success ring-2 ring-background',
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        'group/avatar-group flex -space-x-1.5 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background',
        className,
      )}
      {...props}
    />
  );
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        'relative flex size-7 shrink-0 items-center justify-center rounded-pill bg-control text-[11px] text-fg-muted ring-2 ring-background',
        className,
      )}
      {...props}
    />
  );
}

/** Legacy: gradients are not part of the system. Every key maps to the accent tint. */
const AVATAR_GRADIENTS = {
  purple: 'var(--info-surface)',
  blue: 'var(--info-surface)',
  teal: 'var(--info-surface)',
  pink: 'var(--info-surface)',
} as const;
type AvatarGradient = keyof typeof AVATAR_GRADIENTS;

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
