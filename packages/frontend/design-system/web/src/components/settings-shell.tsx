import { CheckIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * SettingsShell — the Settings pages' frame and nothing in it
 * (`design/version1/Settings.dc.html`): the `SettingsNav` on the left, then a
 * main column on the recessed ground (grey under white cards) that scrolls on
 * its own, holding the measured content column. What goes in it is the page's.
 * Settings stacks its nav over the page on a phone (`flex-col md:flex-row`,
 * the nav a strip there); a shell whose first column is the console's rail
 * stays a row and stacks inside the column beside it.
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
      className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto bg-canvas-recessed', className)}
      {...props}
    />
  );
}

/**
 * The measured content column: the console's 760px and gutter (32px, 16px on
 * a phone), sections 40px apart. Where it opens is `offset`, what sits above it:
 *
 * - `shell` (Settings): 72px down, where a console page's title sits under
 *   its 48px bar; on a phone, 24px under the nav's strip.
 * - `bar` (a bot's settings, under its own bar): 24px down at every width,
 *   as a console page opens under its bar.
 */
const SETTINGS_OFFSET = { shell: 'pt-6 md:pt-18', bar: 'pt-6' } as const;

function SettingsContent({
  offset = 'shell',
  className,
  ...props
}: React.ComponentProps<'div'> & { offset?: keyof typeof SETTINGS_OFFSET }) {
  return (
    <div
      data-slot="settings-content"
      data-offset={offset}
      className={cn('mx-auto flex w-full max-w-190 flex-col gap-10 px-4 pb-18 sm:px-8', SETTINGS_OFFSET[offset], className)}
      {...props}
    />
  );
}

/**
 * How a section opens: the display title at the ladder's h2 stop, a muted
 * line under it, and the section's one action on the right (Add host),
 * aligned to the foot; on a narrow page the action wraps under the text.
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
    <div data-slot="settings-title" className={cn('flex flex-wrap items-end gap-x-4 gap-y-3', className)} {...props}>
      <div className="wrap-lead flex flex-col gap-1.5">
        <h1 className="m-0 font-display text-h2 leading-(--leading-body) font-semibold tracking-[-0.02em] text-fg">
          {title}
        </h1>
        {description ? <p className="m-0 text-operate text-pretty text-fg-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * SettingsTopBar — the bar over a thing's own settings (a bot's), where
 * Settings' nav would not say whose they are: 56px over a hairline, the
 * `back` icon link, the thing's 30px photo and name at 15px, a `badge`
 * (Built-in), then on the right `saved` (a check and "Saved" in muted ink
 * for a moment after a change) and the `actions` (Open chat, the ellipsis).
 */
function SettingsTopBar({
  back,
  avatar,
  title,
  badge,
  saved,
  actions,
  className,
  ...props
}: Omit<React.ComponentProps<'header'>, 'title'> & {
  back?: React.ReactNode;
  avatar?: React.ReactNode;
  title: React.ReactNode;
  badge?: React.ReactNode;
  /** The flash after a save ("Saved"); left out when there is none. */
  saved?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header
      data-slot="settings-top-bar"
      className={cn('flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4', className)}
      {...props}
    >
      {back}
      {avatar ? <span className="flex shrink-0">{avatar}</span> : null}
      <span className="min-w-0 truncate text-[15px] font-medium tracking-[-0.011em] text-fg">{title}</span>
      {badge}
      <span className="flex-1" />
      {saved ? (
        <span
          role="status"
          className="inline-flex animate-in items-center gap-1.5 text-[12.5px] text-fg-muted fade-in-0 slide-in-from-bottom-1"
        >
          <CheckIcon className="size-3.25" aria-hidden />
          {saved}
        </span>
      ) : null}
      {actions ? <span className="flex shrink-0 items-center gap-2">{actions}</span> : null}
    </header>
  );
}

export { SettingsContent, SettingsMain, SettingsShell, SettingsTitle, SettingsTopBar };
