import { Button } from '@oppenheimer/design-system-web';
import { BrandLogo, LanguageSwitcher, ThemeToggle } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The public site's chrome: header with sign-in, footer with the legal links.
 * A section rather than a component because its navigation is the router's.
 */
export function PublicSiteLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-svh bg-canvas text-ink-900">
      <header className="border-b border-border-default">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 lg:px-8">
          <Link to="/about" aria-label={t('public.navigation.home')}>
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button size="sm" render={<Link to="/login" />}>
              {t('public.navigation.signIn')}
            </Button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-border-default">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>{t('public.footer.operator')}</p>
          <nav
            aria-label={t('public.footer.legalNavigation')}
            className="flex flex-wrap gap-x-5 gap-y-2"
          >
            <Link to="/privacy" className="transition-colors hover:text-ink-900">
              {t('public.navigation.privacy')}
            </Link>
            <Link to="/terms" className="transition-colors hover:text-ink-900">
              {t('public.navigation.terms')}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
