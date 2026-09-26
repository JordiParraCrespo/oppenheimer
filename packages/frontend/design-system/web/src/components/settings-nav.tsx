'use client';

import { useRender } from '@base-ui/react/use-render';
import { mergeProps } from '@base-ui/react/merge-props';
import { ChevronLeftIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * SettingsNav — the plain sidebar of the Settings pages: a way back to
 * the console on top, then eyebrow-labelled groups (Account, Workspace)
 * of 30px rows with an icon, a label and a mono count on the right. The
 * current row takes the active wash and medium weight. It sits on the
 * sidebar surface at 264px.
 */
function SettingsNav({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      data-slot="settings-nav"
      className={cn('flex w-[264px] shrink-0 flex-col gap-1 border-r border-sidebar-border bg-sidebar px-3 pt-[18px] text-sidebar-foreground', className)}
      {...props}
    />
  );
}

function SettingsNavGroup({ label, className, children, ...props }: React.ComponentProps<'div'> & { label: React.ReactNode }) {
  return (
    <div data-slot="settings-nav-group" className={cn('mt-3 flex flex-col gap-0.5', className)} {...props}>
      <span className="eyebrow px-2.5 py-1.5">{label}</span>
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
          'flex h-[30px] w-full items-center gap-[9px] rounded-sm px-2.5 text-left text-sm tracking-[-0.009em] text-fg no-underline outline-none transition-colors duration-instant ease-standard hover:bg-hover-surface hover:no-underline focus-visible:outline-2 focus-visible:outline-ring data-active:bg-active-surface data-active:font-medium [&_svg:not([class*=size-])]:size-[15px]',
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
      className={cn('mb-1 text-fg-muted', className)}
      {...props}
    >
      {children}
    </SettingsNavItem>
  );
}

export { SettingsNav, SettingsNavBack, SettingsNavGroup, SettingsNavItem };
