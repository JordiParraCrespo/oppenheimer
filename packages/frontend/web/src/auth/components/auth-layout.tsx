import { useMatches } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import '../lib/legal-note';
import { AuthLink } from './auth-primitives';
import { BrandLogo } from './brand-logo';

export interface AuthLayoutProps {
  /** The wordmark's product suffix; defaults to `common.product`. */
  product?: string;
  /**
   * What fills the right half above 900px: the consumer app's photograph
   * carousel, or nothing for a control plane that has no atmosphere to sell.
   */
  panel?: ReactNode;
  children: ReactNode;
}

/**
 * The auth split from the MVP artboards: the wordmark top-left, a 340px form
 * column centred in the left half, the panel on the right. Below 900px the
 * panel drops away and the form takes the width; it carries no information,
 * only atmosphere. An app's `_auth` route mounts this around its `Outlet`,
 * after `redirectSignedIn` has decided who may be here.
 *
 * These screens follow the OS theme: there is no toggle here. Appearance is
 * chosen from the account menu once signed in.
 *
 * The legal one-liner under the form is the page's when it declares
 * `staticData.legalNoteKey`, the terms-and-privacy line otherwise.
 */
export function AuthLayout({ product, panel, children }: AuthLayoutProps) {
  const { t } = useTranslation();
  // The innermost match that declares a note wins, so a page overrides its
  // layout and a page without one shows the default line.
  const legalNoteKey = useMatches({
    select: (matches) => {
      for (let i = matches.length - 1; i >= 0; i -= 1) {
        const key = matches[i]?.staticData.legalNoteKey;
        if (key) return key;
      }
      return undefined;
    },
  });

  return (
    <div
      className={
        panel
          ? 'grid min-h-svh w-full bg-canvas min-[900px]:grid-cols-2'
          : 'flex min-h-svh w-full bg-canvas'
      }
    >
      <div className="relative flex w-full flex-col px-6 py-8 min-[900px]:px-11 min-[900px]:py-10">
        <BrandLogo product={product} />

        <div className="mx-auto flex w-full max-w-85 flex-1 flex-col justify-center py-10">
          {children}

          <p className="mt-5 text-xs text-pretty text-fg-subtle">
            {legalNoteKey ? (
              t(legalNoteKey)
            ) : (
              <Trans
                i18nKey="auth.legal"
                components={{
                  terms: <AuthLink to="/terms" />,
                  privacy: <AuthLink to="/privacy" />,
                }}
              />
            )}
          </p>
        </div>
      </div>

      {panel}
    </div>
  );
}
