import { Button } from '@oppenheimer/design-system-web';
import {
  ArrowRight,
  KeyRound,
  ShieldCheck,
  UsersRound,
} from '@oppenheimer/design-system-web/icons';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PublicSiteLayout } from '@/components/public/public-site-layout';

export const Route = createFileRoute('/about')({ component: PublicAboutPage });

function PublicAboutPage() {
  const { t } = useTranslation();
  const features = [
    { key: 'team', icon: UsersRound },
    { key: 'access', icon: ShieldCheck },
    { key: 'api', icon: KeyRound },
  ] as const;

  return (
    <PublicSiteLayout>
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8 lg:py-28">
        <div>
          <p className="mb-5 text-sm font-medium tracking-wide text-accent-blue uppercase">
            {t('public.home.eyebrow')}
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-ink-900 sm:text-6xl">
            {t('public.home.title')}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-600">
            {t('public.home.description')}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button size="lg" render={<Link to="/login" />}>
              {t('public.home.cta')}
              <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" size="lg" render={<Link to="/privacy" />}>
              {t('public.home.privacyCta')}
            </Button>
          </div>
        </div>

        <aside className="rounded-3xl border border-border-default bg-surface-50 p-8 shadow-sm">
          <p className="text-sm font-medium text-ink-500">{t('public.home.google.eyebrow')}</p>
          <h2 className="mt-3 text-2xl font-semibold text-ink-900">
            {t('public.home.google.title')}
          </h2>
          <p className="mt-4 leading-7 text-ink-600">{t('public.home.google.body')}</p>
          <p className="mt-5 rounded-2xl bg-background p-4 text-sm leading-6 text-ink-600">
            {t('public.home.google.scope')}
          </p>
        </aside>
      </section>

      <section className="border-t border-border-default bg-surface-50">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-20">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-ink-900">
            {t('public.home.featuresTitle')}
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {features.map(({ key, icon: Icon }) => (
              <article
                key={key}
                className="rounded-2xl border border-border-default bg-background p-6"
              >
                <Icon className="size-6 text-accent-blue" />
                <h3 className="mt-5 text-lg font-semibold text-ink-900">
                  {t(`public.home.features.${key}.title`)}
                </h3>
                <p className="mt-2 leading-7 text-ink-600">
                  {t(`public.home.features.${key}.body`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
