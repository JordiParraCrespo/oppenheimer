import { Button } from '@oppenheimer/design-system-web';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/auth/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export function PublicSiteLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-svh bg-background text-ink-900">
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

export function LegalPage({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <PublicSiteLayout>
      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-20 lg:px-8">
        <header className="mb-12 border-b border-border-default pb-10">
          <p className="mb-3 text-sm font-medium tracking-wide text-accent-blue uppercase">
            {eyebrow}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-lg leading-8 text-ink-600">{summary}</p>
        </header>
        <div className="space-y-10">{children}</div>
      </article>
    </PublicSiteLayout>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold text-ink-900">{title}</h2>
      <div className="space-y-3 text-base leading-7 text-ink-600">{children}</div>
    </section>
  );
}
