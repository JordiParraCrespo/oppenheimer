import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  SidebarMenuButton,
} from '@oppenheimer/design-system-web';
import { ChevronsUpDown, LogOut, Settings, UserRound } from '@oppenheimer/design-system-web/icons';
import { useLogout, useProfile } from '@oppenheimer/frontend/react';
import { locales } from '@oppenheimer/translations/locales';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The account row at the foot of the sidebar: avatar, name and role, opening
 * a menu to the right. The plan row names the workspace the session is scoped
 * to, which is the one piece of context the sidebar cannot show anywhere else.
 */
export function UserMenu({ trigger = 'sidebar' }: { trigger?: 'sidebar' | 'avatar' }) {
  const { t, i18n } = useTranslation();
  const { data: user } = useProfile();
  const navigate = useNavigate();
  const logout = useLogout({ onSuccess: () => navigate({ to: '/login' }) });

  const currentLocale = i18n.resolvedLanguage ?? i18n.language;
  const name = user ? `${user.firstName} ${user.lastName}` : '';
  const initials = user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` : '';

  return (
    <DropdownMenu>
      {trigger === 'avatar' ? (
        <DropdownMenuTrigger
          render={
            <IconButton
              variant="ghost"
              aria-label={`${t('nav.profile')}: ${name}`}
              className="size-8.5 cursor-pointer"
            />
          }
        >
          <Avatar size={28}>
            <AvatarFallback gradient="purple">{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton size="lg" className="gap-2.5 px-2 data-open:bg-surface-hover" />
          }
        >
          <Avatar size={28}>
            <AvatarFallback gradient="purple">{initials}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium text-ink-900">{name}</span>
            <span className="mt-px block truncate text-xs text-ink-400">{user?.role}</span>
          </span>
          <ChevronsUpDown className="text-ink-400" />
        </DropdownMenuTrigger>
      )}

      <DropdownMenuContent
        side={trigger === 'avatar' ? 'bottom' : 'right'}
        align="end"
        sideOffset={10}
        className="w-64"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex min-w-0 items-center gap-3 px-2 py-1.5 font-normal">
            <Avatar size={28}>
              <AvatarFallback gradient="purple">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="mt-0.5 truncate text-xs text-ink-600">{user?.email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link to="/profile" />}>
            <UserRound />
            {t('nav.viewProfile')}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/settings" />}>
            <Settings />
            {t('nav.settings')}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
          {locales.map((locale) => (
            <DropdownMenuCheckboxItem
              key={locale}
              checked={currentLocale === locale}
              onCheckedChange={() => i18n.changeLanguage(locale)}
            >
              {t(`language.${locale}`)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => logout.mutate()}
            className="text-destructive [&_svg]:text-destructive"
          >
            <LogOut />
            {t('nav.logOut')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
