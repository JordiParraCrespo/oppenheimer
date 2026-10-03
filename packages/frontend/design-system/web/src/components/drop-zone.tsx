'use client';

import * as React from 'react';

import { useFileDrag } from '../hooks/use-file-drag';
import { cn } from '../lib/utils';

/**
 * DropZone — a pane that takes files dropped on it: New session (the files
 * join the composer's attachments) and a running session's terminal (each
 * file is put on the host and its path goes into the input).
 *
 * It wraps the pane and draws nothing until a drag carrying files comes in;
 * then the whole pane takes the frames' 7% wash of the action blue, edge to
 * edge: no inset, no radius, no border and no label. Wrap the pane itself
 * (the main column beside the sidebar), so the wash covers exactly it. It
 * exists only while the drag does, fades in, and never takes the pointer,
 * so the pane under it stays exactly as it was.
 *
 * The zone is its own box (`listen="self"`, the default), so two zones on a
 * page, or a file input inside one, each get only their own drops.
 * `listen="window"` counts a drop anywhere in the window, so a near miss
 * still lands and the browser never opens the file in the tab; use it only
 * where the page has exactly one zone, since every window zone receives every
 * drop. Only files count: a dragged link or text is left to the browser.
 */
function DropZone({
  onFiles,
  listen = 'self',
  disabled = false,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  onFiles: (files: File[]) => void;
  /** `window` only on a page with one zone. */
  listen?: 'self' | 'window';
  disabled?: boolean;
}) {
  const zone = React.useRef<HTMLDivElement>(null);
  const dragging = useFileDrag(listen === 'window' ? 'window' : zone, { onFiles, disabled });

  return (
    <div
      ref={zone}
      data-slot="drop-zone"
      data-dragging={dragging || undefined}
      className={cn('relative', className)}
      {...props}
    >
      {children}
      {dragging ? (
        <div
          aria-hidden
          data-slot="drop-zone-overlay"
          className="pointer-events-none absolute inset-0 z-10 bg-[color-mix(in_srgb,var(--primary)_7%,transparent)] motion-safe:animate-label-in"
        />
      ) : null}
    </div>
  );
}

export { DropZone };
