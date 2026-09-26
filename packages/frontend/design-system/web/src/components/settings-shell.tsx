import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * SettingsShell — the Settings pages' frame and nothing in it
 * (`design/version1/Settings.dc.html`): the `SettingsNav` on the left at
 * 264px, then a main column on the canvas that scrolls on its own, holding a
 * 760px content column with 64px over 40px of gutter and 96px of air
 * underneath, its sections 40px apart. What a page puts in the column — a
 * title, `SettingsGroup`s, `HostCard`s, or the Add a host page's header and
 * steps — is the page's.
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
      className={cn('flex h-dvh min-h-0 overflow-hidden bg-background text-fg', className)}
      {...props}
    />
  );
}

/** The column beside the nav: the canvas, scrolling on its own. */
function SettingsMain({ className, ...props }: React.ComponentProps<'main'>) {
  return (
    <main
      data-slot="settings-main"
      className={cn('min-w-0 flex-1 overflow-y-auto bg-canvas', className)}
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
 * How a section opens: the 28px display title, a muted line under it, and
 * the section's one action on the right (Add host), aligned to the foot.
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
        <h1 className="m-0 font-display text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-fg">
          {title}
        </h1>
        {description ? <p className="m-0 text-sm text-pretty text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export { SettingsContent, SettingsMain, SettingsShell, SettingsTitle };
