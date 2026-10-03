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
 * then an outline in the action blue lies 8px inside the pane's edge, 3px at
 * the 18px radius over a 7% blue wash, with one pill in the middle saying
 * what the drop will do ("Drop to attach"). It fades in and out at 140ms and
 * never takes the pointer, so the pane under it stays exactly as it was.
 *
 * `listen="window"` (the default) counts a drop anywhere in the window, so a
 * file let go a little outside the pane still lands, and the browser never
 * opens it in the tab; `listen="self"` keeps the zone to its own box, for a
 * page that holds more than one. Only files count: a dragged link or text is
 * left to the browser.
 */
function DropZone({
  onFiles,
  label = 'Drop to attach',
  listen = 'window',
  disabled = false,
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  onFiles: (files: File[]) => void;
  /** The pill: what dropping does. */
  label?: React.ReactNode;
  listen?: 'window' | 'self';
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
      <div
        aria-hidden
        data-slot="drop-zone-overlay"
        className={cn(
          'pointer-events-none absolute inset-2 z-50 flex items-center justify-center rounded-lg border-3 border-primary bg-[color-mix(in_srgb,var(--primary)_7%,transparent)] opacity-0 transition-opacity duration-fast ease-standard',
          dragging && 'opacity-100',
        )}
      >
        <span className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

export { DropZone };
