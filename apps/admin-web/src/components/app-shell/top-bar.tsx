import { IconButton, Kbd, useSidebar } from '@oppenheimer/design-system-web';
import { Menu, Moon, Search, Sun } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { UserMenu } from '@/components/app-shell/user-menu';
import { useTheme } from '@/components/theme-provider';

/**
 * The 56px chrome bar: sidebar toggle, the centred search trigger that opens
 * the command palette, then the theme toggle and the account avatar.
 */
export function TopBar({ onSearch }: { onSearch: () => void }) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { toggleSidebar } = useSidebar();

  const isDark = theme === 'dark';

  return (
    <header className="flex h-14 flex-none items-center gap-5 border-b border-border-subtle bg-chrome-bg px-5">
      {/* Not the design system's `SidebarTrigger`: that one draws its own
          panel glyph, and the brand's chrome bar opens with a hamburger. */}
      <IconButton
        variant="ghost"
        aria-label={t('nav.toggleSidebar')}
        onClick={toggleSidebar}
        className="size-8.5 text-ink-600"
      >
        <Menu className="size-4.5" />
      </IconButton>

      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={onSearch}
          className="inline-flex h-9 w-95 max-w-[44vw] items-center gap-2.5 rounded-full border border-border-default bg-card px-3 transition-colors hover:border-border-strong hover:bg-surface-hover"
        >
          <Search className="size-3.75 text-ink-400" />
          <span className="flex-1 text-left text-base text-ink-400">{t('nav.search')}</span>
          <Kbd className="flex-none">⌘K</Kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <IconButton
          variant="ghost"
          aria-label={t('theme.toggle')}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="size-8.5 cursor-pointer text-ink-600"
        >
          {isDark ? <Sun /> : <Moon />}
        </IconButton>

        <UserMenu trigger="avatar" />
      </div>
    </header>
  );
}
