'use client';

import { ImageIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * ChatImage — an image in a bot's chat, as a square thumbnail on the 10px
 * radius: `md` (56px) in the composer while it waits to be sent, `lg`
 * (160px) on the turn that sent it. The picture covers the tile; until it
 * is there (`src` left out) the tile is the hover wash with the image
 * glyph, so a list of them never jumps. `pending` breathes while the image
 * uploads, under `motion-safe`; `invalid` rings it in the destructive tone
 * when it was refused (the reason is said under the composer, not here).
 *
 * The tile is an `img` with its `alt`; the caller wraps it in a link to
 * open it full size. Its corner action is a child: `ChatImageRemove`, the
 * small round cross a composer's tile carries.
 */
function ChatImage({
  src,
  alt,
  size = 'md',
  pending = false,
  invalid = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  src?: string;
  /** What the image is, for a screen reader: its file name when nothing better is known. */
  alt: string;
  size?: 'md' | 'lg';
  pending?: boolean;
  invalid?: boolean;
  /** The tile's corner action (`ChatImageRemove`). */
  children?: React.ReactNode;
}) {
  return (
    <span
      data-slot="chat-image"
      data-size={size}
      data-pending={pending || undefined}
      data-invalid={invalid || undefined}
      aria-busy={pending || undefined}
      className={cn(
        'group/image relative inline-flex shrink-0 items-center justify-center rounded-md bg-hover-surface text-fg-subtle data-invalid:ring-2 data-invalid:ring-destructive data-[size=lg]:size-40 data-[size=md]:size-14 data-pending:motion-safe:animate-shimmer',
        className,
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="size-full rounded-md object-cover group-data-pending/image:opacity-60"
        />
      ) : (
        <ImageIcon role="img" aria-label={alt} className="size-4.5" />
      )}
      {children}
    </span>
  );
}

/** The cross on a composer's `ChatImage`: takes the image off the message before it is sent. */
function ChatImageRemove({
  label,
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children' | 'aria-label'> & {
  /** What a screen reader hears: "Remove screenshot.png". */
  label: string;
}) {
  return (
    <button
      type="button"
      data-slot="chat-image-remove"
      aria-label={label}
      title={label}
      className={cn(
        'absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-fg text-background shadow-sm outline-none transition-opacity duration-fast focus-visible:ring-3 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <XIcon className="size-3" strokeWidth={2.4} />
    </button>
  );
}

export { ChatImage, ChatImageRemove };
