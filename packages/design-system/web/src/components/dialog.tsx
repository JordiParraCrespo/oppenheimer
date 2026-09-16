'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { IconButton } from './icon-button';

/**
 * Dialog — the one modal surface: 28px radius on the popover tier, the modal
 * shadow (one of three layers allowed one), over a scrim with a 3px blur.
 * Enters with the 4px rise plus fade over 220ms; nothing slides in from an edge.
 *
 * Anatomy from the welcome modal: `DialogHeader` (title, optional close),
 * `DialogDescription`, `DialogBody`, `DialogFooter` with one primary block
 * button. Destructive copy states the cost, and the button says exactly what
 * it does: "Stop run", not "Confirm".
 */
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

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 isolate z-50 bg-overlay backdrop-blur-[3px] transition-opacity duration-base ease-standard data-starting-style:opacity-0 data-ending-style:opacity-0',
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  size = 'md',
  showCloseButton = true,
  closeLabel = 'Close',
  ...props
}: DialogPrimitive.Popup.Props & {
  size?: 'md' | 'lg';
  showCloseButton?: boolean;
  closeLabel?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-size={size}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100svh-3rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-popover text-fg shadow-modal outline-none transition-[opacity,transform] duration-base ease-out data-starting-style:translate-y-[calc(-50%+4px)] data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:translate-y-[calc(-50%+4px)] data-ending-style:scale-[0.98] data-ending-style:opacity-0',
          size === 'lg' ? 'max-w-[640px]' : 'max-w-[440px]',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            render={
              <IconButton
                aria-label={closeLabel}
                size="sm"
                className="absolute top-5 right-5"
              />
            }
          >
            <XIcon />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 px-7 pt-7 pr-14', className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-h3 font-semibold text-fg', className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-operate text-fg-muted', className)}
      {...props}
    />
  );
}

/** The only part of a tall dialog that scrolls; header and footer stay put. */
function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-body"
      className={cn('min-h-0 flex-1 overflow-y-auto px-7 pt-5 text-operate text-fg', className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 px-7 pt-5 pb-7 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Legacy: the starter's gradient hero band. Gradients are not part of this
 * system; it now renders a flat tonal panel so the unported screens keep
 * their layout until they are rebuilt.
 */
function DialogHero({
  className,
  gradient: _gradient,
  ...props
}: React.ComponentProps<'div'> & { gradient?: string }) {
  return (
    <div
      data-slot="dialog-hero"
      className={cn('flex items-center justify-center gap-3 bg-control px-7 py-8', className)}
      {...props}
    />
  );
}

/** Legacy companion of `DialogHero`. */
function DialogHeroPlate({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-hero-plate"
      className={cn(
        'flex size-14 items-center justify-center rounded-md bg-card text-fg',
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
