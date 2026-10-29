'use client';

import { useRender } from '@base-ui/react/use-render';
import { mergeProps } from '@base-ui/react/merge-props';
import { ChevronLeftIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * SettingsNav — the plain sidebar of the Settings pages: a way back to
 * the console on top, then eyebrow-labelled groups (Account, Workspace)
 * of 32px rows with an icon, a label and a mono count on the right. The
 * current row is lit (the sidebar's active surface) and medium weight. It is
 * the version-1 glass rail at 264px: the sidebar surface at 72% over the
 * page, blurred (`design/version1/ds-base.js`, `.op-sidebar`).
 *
 * It has two layouts, and the width picks one with no script or re-render:
 * the `STRIP` under 768px, where there is no room for a column beside the
 * page (the same rows side by side, wrapping onto a second line rather than
 * cutting a row off at the edge, the group labels dropped, the hairline under
 * it), and the `RAIL` from 768px. Each part
 * below names its two layouts the same way. The parent puts the nav above
 * the page or beside it (`SettingsShell`).
 */
const NAV = {
  surface:
    'shrink-0 border-sidebar-border bg-sidebar/72 text-sidebar-foreground backdrop-blur-[20px] backdrop-saturate-[1.8]',
  strip: 'flex w-full flex-wrap items-center gap-1 border-b px-3 py-2',
  rail: 'md:w-[264px] md:flex-col md:flex-nowrap md:items-stretch md:border-r md:border-b-0 md:pt-[18px] md:pb-0',
};

function SettingsNav({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav data-slot="settings-nav" className={cn(NAV.surface, NAV.strip, NAV.rail, className)} {...props} />;
}

const GROUP = {
  strip: 'flex flex-wrap items-center gap-0.5',
  rail: 'md:mt-1 md:flex-col md:items-stretch md:[&+&]:mt-3.5',
};

function SettingsNavGroup({ label, className, children, ...props }: React.ComponentProps<'div'> & { label: React.ReactNode }) {
  return (
    <div
      data-slot="settings-nav-group"
      className={cn(GROUP.strip, GROUP.rail, className)}
      {...props}
    >
      <span className="eyebrow hidden px-2.5 py-1.5 leading-(--leading-body) md:block">{label}</span>
      {children}
    </div>
  );
}

function SettingsNavItem({
  icon,
  count,
  active,
  className,
  render,
  children,
  ...props
}: useRender.ComponentProps<'button'> &
  React.ComponentProps<'button'> & {
    icon?: React.ReactNode;
    count?: React.ReactNode;
    active?: boolean;
  }) {
  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(
      {
        type: 'button',
        className: cn(
          'flex h-8 w-auto shrink-0 items-center gap-2.5 rounded-xs px-2.5 md:w-full md:shrink text-left text-operate text-fg no-underline outline-none transition-colors duration-instant ease-standard hover:bg-sidebar-item-hover hover:no-underline focus-visible:outline-2 focus-visible:outline-ring data-active:bg-sidebar-item-active data-active:font-medium [&_svg:not([class*=size-])]:size-[15px]',
          className,
        ),
        children: (
          <>
            {icon ? (
              <span aria-hidden className={cn('flex shrink-0', active ? 'text-fg' : 'text-sidebar-muted')}>
                {icon}
              </span>
            ) : null}
            <span className="min-w-0 flex-1 truncate">{children}</span>
            {count !== undefined ? <span className="figures shrink-0 text-[11px] text-fg-subtle">{count}</span> : null}
          </>
        ),
      },
      props,
    ),
    render,
    state: { slot: 'settings-nav-item', active: active || undefined },
  });
}

/** The row at the top that leaves Settings: a left chevron and "Back to console". */
function SettingsNavBack({ className, children, ...props }: React.ComponentProps<typeof SettingsNavItem>) {
  return (
    <SettingsNavItem
      data-slot="settings-nav-back"
      icon={<ChevronLeftIcon />}
      className={cn('text-fg-muted md:mb-1', className)}
      {...props}
    >
      {children}
    </SettingsNavItem>
  );
}

export { SettingsNav, SettingsNavBack, SettingsNavGroup, SettingsNavItem };
