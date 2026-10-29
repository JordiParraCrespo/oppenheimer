'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ImageIcon, XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { IconButton } from './icon-button';

/**
 * ChatImage — an image in a bot's chat, as a square thumbnail on the 10px
 * radius: `md` (56px) in the composer while it waits to be sent, `lg`
 * (160px) on the turn that sent it. The picture covers the tile; until it
 * is there (`src` left out) the tile is the hover wash with the image
 * glyph, so a list of them never jumps. `pending` breathes while the image
 * uploads, under `motion-safe`; `invalid` rings it in the destructive tone
 * when it was refused (the reason is said under the composer, not here).
 *
 * The tile is an `img` with its `alt`; the caller wraps it in
 * `ChatImageButton` to open it in `ChatImageViewer`. Its corner action is a
 * child: `ChatImageRemove`, the small round cross a composer's tile carries.
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
        <>
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="size-full rounded-md object-cover group-data-pending/image:opacity-60"
          />
          {/* A hairline on the picture's edge: a white screenshot keeps its tile on a white page. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-border-subtle ring-inset"
          />
        </>
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

/**
 * The press that opens a `ChatImage` in `ChatImageViewer`: the tile itself,
 * zooming in on hover, with the focus ring on its own radius.
 */
function ChatImageButton({
  label,
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'aria-label'> & {
  /** What a screen reader hears: "Open screenshot.png". */
  label: string;
}) {
  return (
    <button
      type="button"
      data-slot="chat-image-button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 cursor-zoom-in rounded-md outline-none transition-transform duration-fast ease-standard hover:brightness-95 focus-visible:ring-3 focus-visible:ring-ring active:scale-[0.985]',
        className,
      )}
      {...props}
    />
  );
}

/**
 * ChatImageViewer — an image of the chat seen whole, the way the chat's
 * images open: over the page on a dark scrim, as large as the window lets it
 * be and never larger than it is, with its name and its place among the
 * images beside it ("2 of 3") over it. ← and → (and the two round buttons on
 * its flanks) go through the images; Esc, the cross or a press on the scrim
 * close it. `download` is the address the arrow at the top saves it from.
 *
 * Controlled: the caller holds which image is open (`index`) and renders it
 * as the child, `ChatImageViewerImage`, so an image that is still loading
 * keeps its place while the viewer is already open.
 */
function ChatImageViewer({
  open,
  onOpenChange,
  index,
  count,
  onIndexChange,
  name,
  download,
  labels,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  index: number;
  count: number;
  onIndexChange: (index: number) => void;
  /** The open image's name, over it. */
  name: string;
  /** Where the open image is saved from, and the name it is saved as. */
  download?: { href: string; filename: string };
  labels: {
    close: string;
    previous: string;
    next: string;
    download: string;
    /** "2 of 3", from the open image's position counted from 1. */
    position: (position: number, count: number) => string;
  };
  /** The open image: `ChatImageViewerImage`. */
  children: React.ReactNode;
}) {
  const go = (step: number) => {
    if (count < 2) return;
    onIndexChange((index + step + count) % count);
  };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-slot="chat-image-viewer-scrim"
          className="fixed inset-0 isolate z-50 bg-black/90 backdrop-blur-md transition-opacity duration-base ease-standard data-starting-style:opacity-0 data-ending-style:opacity-0"
        />
        <DialogPrimitive.Popup
          data-slot="chat-image-viewer"
          aria-label={name}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') go(-1);
            else if (event.key === 'ArrowRight') go(1);
            else return;
            event.preventDefault();
          }}
          className="fixed inset-0 z-50 flex flex-col text-white outline-none transition-[opacity,transform] duration-base ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0"
        >
          <div className="flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6">
            <DialogPrimitive.Title className="m-0 min-w-0 truncate text-operate font-medium text-white">
              {name}
            </DialogPrimitive.Title>
            {count > 1 ? (
              <span className="shrink-0 text-meta text-white/60 tabular-nums">
                {labels.position(index + 1, count)}
              </span>
            ) : null}
            <span className="flex-1" />
            {download ? (
              <a
                href={download.href}
                download={download.filename}
                aria-label={labels.download}
                title={labels.download}
                className="inline-flex size-(--control-h-md) items-center justify-center rounded-pill text-white/75 outline-none transition-colors duration-fast hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-ring"
              >
                <DownloadIcon className="size-4" />
              </a>
            ) : null}
            <DialogPrimitive.Close
              render={
                <IconButton
                  aria-label={labels.close}
                  title={labels.close}
                  className="text-white/75 hover:bg-white/10 hover:text-white"
                />
              }
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>
          {/* A press on the ground around the image closes it, as on the scrim. */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Esc and the cross are the keyboard's way out */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc and the cross are the keyboard's way out */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-16"
            onClick={(event) => {
              if (event.target === event.currentTarget) onOpenChange(false);
            }}
          >
            {children}
            {count > 1 ? (
              <>
                <IconButton
                  aria-label={labels.previous}
                  title={labels.previous}
                  variant="solid"
                  size="lg"
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-3 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 sm:left-4"
                >
                  <ChevronLeftIcon />
                </IconButton>
                <IconButton
                  aria-label={labels.next}
                  title={labels.next}
                  variant="solid"
                  size="lg"
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 sm:right-4"
                >
                  <ChevronRightIcon />
                </IconButton>
              </>
            ) : null}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * The image `ChatImageViewer` shows, contained in the window at no more
 * than its own size; until `src` is there, its glyph breathing in its place.
 */
function ChatImageViewerImage({ src, alt }: { src?: string; alt: string }) {
  if (!src) {
    return (
      <span
        data-slot="chat-image-viewer-image"
        aria-busy
        className="inline-flex size-40 items-center justify-center rounded-md bg-white/10 text-white/60 motion-safe:animate-shimmer"
      >
        <ImageIcon role="img" aria-label={alt} className="size-6" />
      </span>
    );
  }
  return (
    <img
      data-slot="chat-image-viewer-image"
      src={src}
      alt={alt}
      draggable={false}
      className="max-h-full max-w-full rounded-md object-contain shadow-modal"
    />
  );
}

export { ChatImage, ChatImageButton, ChatImageRemove, ChatImageViewer, ChatImageViewerImage };
