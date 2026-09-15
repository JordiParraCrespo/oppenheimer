import {
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
import { NAV } from '@/components/app-shell/nav';
import { UserMenu } from '@/components/app-shell/user-menu';
import { BrandGlyph } from '@/components/brand-glyph';

export function AppSidebar() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <Sidebar className="border-r border-border-subtle">
      <SidebarHeader className="p-3">
        <div className="flex min-w-0 items-center gap-2.5 px-2 py-2">
          <BrandGlyph />
          <span className="truncate text-base font-medium text-ink-900">Oppenheimer Control</span>
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
              {NAV.map((entry) => {
                const Icon = entry.icon;
                return (
                  <SidebarMenuItem key={entry.to}>
                    <SidebarMenuButton
                      isActive={pathname === entry.to}
                      render={<Link to={entry.to} />}
                    >
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
