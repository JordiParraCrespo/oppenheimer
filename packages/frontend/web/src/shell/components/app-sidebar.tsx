import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@oppenheimer/design-system-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuthorizedNav } from '../hooks/use-authorized-nav';
import { useShell } from '../hooks/use-shell';
import { UserMenu } from './user-menu';

function workspaceInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '—';
}

/**
 * The workspace sidebar: brand row, the app's own body, and the user menu
 * pinned to the bottom. 264px and the hairline against the canvas both come
 * from the design system's `Sidebar`, which is already cut to this brand.
 *
 * The measurements are the design export's, not this file's invention: the
 * head is one `--topbar-h` tall with 16px of leading space (`.op-sidebar__head`)
 * and the foot is 10px/12px (`.op-sidebar__foot`), which is what keeps the
 * brand row level with the content bar of an app that has one.
 *
 * The body is the nav list unless the app passed a `sidebar` of its own. The
 * console's is its session list, which is a feature rather than kit because
 * it reads a product hook; the brand row and the account menu stay here, so
 * an app that replaces the middle still gets both.
 */
export function AppSidebar() {
  const { t } = useTranslation();
  const { workspace, sidebar, brand, chrome = true } = useShell();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  // Only the routes this user's permissions actually reach — a restricted user
  // never sees a row that would answer with "No tienes permiso para hacer eso".
  const entries = useAuthorizedNav();
  // What the app calls the workspace: the consumer app passes the caller's
  // organization (from the same query General Settings reads, so a saved name
  // or logo shows here at once); the control plane passes its own label.
  const workspaceName = workspace?.name ?? t('common.appName');

  return (
    <Sidebar>
      <SidebarHeader className="h-14 flex-none flex-row items-center justify-between gap-2 py-0 pr-3 pl-4">
        {brand ?? (
          <div className="flex min-w-0 items-center gap-2.5">
            {workspace?.icon ?? (
              <Avatar size={24} className="rounded-md after:rounded-md">
                {workspace?.logo && (
                  <AvatarImage src={workspace.logo} alt="" className="rounded-md object-contain" />
                )}
                <AvatarFallback className="rounded-md bg-surface-sunken font-medium text-ink-600">
                  {workspaceInitial(workspaceName)}
                </AvatarFallback>
              </Avatar>
            )}
            <span className="truncate text-base font-medium text-ink-900">{workspaceName}</span>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {sidebar ?? (
          <SidebarGroup
            className="px-3 py-0"
            role="navigation"
            aria-label={t('nav.primaryNavigation')}
          >
            <SidebarGroupContent>
              <SidebarMenu className="gap-px">
                {entries.map((entry) => {
                  const Icon = entry.icon;
                  // `/sessions/new` should still light up Sessions, so match on
                  // the prefix rather than the exact path.
                  const active = pathname === entry.to || pathname.startsWith(`${entry.to}/`);

                  return (
                    <SidebarMenuItem key={entry.to}>
                      <SidebarMenuButton isActive={active} render={<Link to={entry.to} />}>
                        <Icon />
                        <span>{t(`nav.${entry.labelKey}`)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* The hairline above the account row is the control plane's, like the
          bar at the top: the console's list scrolls to the foot and the
          artboard draws no line there. */}
      <SidebarFooter className={chrome ? undefined : 'border-t-0'}>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
