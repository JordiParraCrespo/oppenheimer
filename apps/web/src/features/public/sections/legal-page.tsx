import type { ReactNode } from 'react';
import { PublicSiteLayout } from './public-site-layout';

/** A legal page (terms, privacy) inside the public site's chrome. */
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
