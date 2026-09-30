import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * SettingsShell — the Settings pages' frame and nothing in it
 * (`design/version1/Settings.dc.html`): the `SettingsNav` on the left, then a
 * main column on the recessed ground (grey under white cards) that scrolls on
 * its own, holding the measured content column. What goes in it is the page's.
 *
 * ```tsx
 * <SettingsShell>
 *   <SettingsNav>…</SettingsNav>
 *   <SettingsMain>
 *     <SettingsContent>…</SettingsContent>
 *   </SettingsMain>
 * </SettingsShell>
 * ```
 */
function SettingsShell({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="settings-shell"
      className={cn('flex h-dvh min-h-0 overflow-hidden bg-canvas-recessed text-fg', className)}
      {...props}
    />
  );
}

/** The column beside the nav: the canvas, scrolling on its own. */
function SettingsMain({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="settings-main"
      className={cn('min-w-0 flex-1 overflow-y-auto bg-canvas-recessed', className)}
      {...props}
    />
  );
}

/** The measured content column: 760px, centred, the export's padding, sections 40px apart. */
function SettingsContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="settings-content"
      className={cn('mx-auto flex w-full max-w-190 flex-col gap-10 px-10 pt-16 pb-24', className)}
      {...props}
    />
  );
}

/**
 * How a section opens: the display title at the ladder's h2 stop, a muted
 * line under it, and the section's one action on the right (Add host),
 * aligned to the foot.
 */
function SettingsTitle({
  title,
  description,
  action,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div data-slot="settings-title" className={cn('flex items-end gap-4', className)} {...props}>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h1 className="m-0 font-display text-h2 leading-(--leading-body) font-semibold tracking-[-0.02em] text-fg">
          {title}
        </h1>
        {description ? <p className="m-0 text-operate text-pretty text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export { SettingsContent, SettingsMain, SettingsShell, SettingsTitle };
