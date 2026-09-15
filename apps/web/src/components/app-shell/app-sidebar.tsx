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
import { useOrganizations } from '@oppenheimer/frontend/react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuthorizedNav } from '@/components/app-shell/use-authorized-nav';
import { UserMenu } from '@/components/app-shell/user-menu';

function organizationInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '—';
}

/**
 * The workspace sidebar: brand row, the nav, and the user menu pinned to the
 * bottom. 244px and the hairline against the canvas both come from the design
 * system's `Sidebar`, which is already cut to this brand.
 */
export function AppSidebar() {
  const { t } = useTranslation();
  const { data: organizations } = useOrganizations();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  // Only the routes this user's permissions actually reach — a restricted user
  // never sees a row that would answer with "No tienes permiso para hacer eso".
  const entries = useAuthorizedNav();
  // The shell shows the first organization the caller belongs to. Keeping this
  // on the same list query as General Settings means a saved name or logo is
  // reflected here immediately from the query cache.
  const organization = organizations?.[0];
  const organizationName = organization?.name ?? t('common.appName');

  return (
    <Sidebar className="border-r border-border-subtle">
      <SidebarHeader className="p-3">
        <div className="flex min-w-0 items-center gap-2.5 px-2 py-2">
          <Avatar size={24} className="rounded-md after:rounded-md">
            {organization?.logo && (
              <AvatarImage src={organization.logo} alt="" className="rounded-md object-contain" />
            )}
            <AvatarFallback className="rounded-md bg-surface-sunken font-medium text-ink-600">
              {organizationInitial(organizationName)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-base font-medium text-ink-900">{organizationName}</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup
          className="px-3 py-0"
          role="navigation"
          aria-label={t('nav.primaryNavigation')}
        >
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {entries.map((entry) => {
                const Icon = entry.icon;
                // `/settings/api-tokens` should still light up Settings, so
                // match on the prefix rather than the exact path.
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
      </SidebarContent>

      <SidebarFooter className="p-3">
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
