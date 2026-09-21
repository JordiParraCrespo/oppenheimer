import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuValue,
  IconButton,
  SidebarMenuButton,
} from '@oppenheimer/design-system-web';
import { ChevronDown, Globe, LogOut, Moon } from '@oppenheimer/design-system-web/icons';
import { useLogout, useProfile } from '@oppenheimer/frontend-core/react';
import { type Locale, locales } from '@oppenheimer/translations/locales';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { type ThemePreference, useTheme } from '../../theme';
import { useShell } from '../hooks/use-shell';

/** The appearances the menu offers, in the order the artboard lists them. */
const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/**
 * The account row at the foot of the sidebar, and the menu it opens.
 *
 * Both are the artboard's, down to the measurements
 * (`product/versions/mvp/design/version1/SessionsConsole.dc.html`): a 32px
 * `.op-navitem` of 22px accent avatar, name and a 14px chevron — no second
 * line, because the role under someone's own name is a fact about them they
 * already know — over a 250px `.op-accountmenu` that is the account's e-mail,
 * appearance, language and the way out. The two middle rows carry the 15px
 * moon and globe the export draws in the `.op-menu__icon` slot, and "Log out"
 * the 15px door, in the one tone the menu is allowed to colour.
 *
 * Appearance and language open sideways rather than unrolling in place, so
 * the menu is four rows tall whatever is in it, and the console loses nothing
 * by having no chrome bar to put a theme toggle in.
 */
export function UserMenu({ trigger = 'sidebar' }: { trigger?: 'sidebar' | 'avatar' }) {
  const { t, i18n } = useTranslation();
  const { userMenuLinks = [] } = useShell();
  const { theme, setTheme } = useTheme();
  const { data: user } = useProfile();
  const navigate = useNavigate();
  const logout = useLogout({ onSuccess: () => navigate({ to: '/login' }) });

  // Narrowed to `Locale` because the menu *names* it (`language.en`), not just
  // compares it: `t()` is typed over the catalog, and a bare `string` in the
  // key would not resolve to one. i18next only ever resolves to a locale the
  // app registered, which is this union.
  const currentLocale = (i18n.resolvedLanguage ?? i18n.language) as Locale;
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
          <Avatar size="md" variant="accent">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger render={<SidebarMenuButton aria-label={name} />}>
          {/* The one tinted thing in the sidebar: `.op-avatar--accent`, which
              is what tells the row apart from the session list above it. */}
          <Avatar size="sm" variant="accent">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-left">{name}</span>
          <ChevronDown className="size-3.5! text-sidebar-muted" />
        </DropdownMenuTrigger>
      )}

      <DropdownMenuContent
        side={trigger === 'avatar' ? 'bottom' : 'top'}
        align={trigger === 'avatar' ? 'end' : 'start'}
        sideOffset={6}
        className="min-w-[250px]"
      >
        {/* The identity line, not a second avatar: which account this is, is
            the one thing the row below the menu cannot already show. */}
        <DropdownMenuHeader>{user?.email}</DropdownMenuHeader>

        {userMenuLinks.length > 0 && (
          <>
            <DropdownMenuGroup>
              {userMenuLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <DropdownMenuItem key={link.to} render={<Link to={link.to} />}>
                    <Icon />
                    {t(`nav.${link.labelKey}`)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Moon />
              {t('theme.label')}
              <DropdownMenuValue>{t(`theme.${theme}`)}</DropdownMenuValue>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {/* One choice, so radio rather than a row of ticks: the menu is
                  saying which appearance is on, not which are. */}
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(next) => setTheme(next as ThemePreference)}
              >
                {THEMES.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {t(`theme.${option}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Globe />
              {t('language.label')}
              <DropdownMenuValue>{t(`language.${currentLocale}`)}</DropdownMenuValue>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={currentLocale}
                onValueChange={(next) => i18n.changeLanguage(next as Locale)}
              >
                {locales.map((locale) => (
                  <DropdownMenuRadioItem key={locale} value={locale}>
                    {t(`language.${locale}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={() => logout.mutate()}>
            <LogOut />
            {t('nav.logOut')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
