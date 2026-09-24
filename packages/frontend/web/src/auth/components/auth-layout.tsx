import { useMatches } from '@tanstack/react-router';
import type { ParseKeys } from 'i18next';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { AuthLink } from './auth-primitives';
import { BrandLogo } from './brand-logo';

/**
 * How a page is framed inside the auth split. Each is route `staticData`, read
 * off the innermost match that declares it, so a page overrides its layout and
 * no page reaches up into the layout's state to register anything.
 */
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /**
     * The legal one-liner pinned under the centred column: a key for that
     * line, or `null` for no line at all. A page that declares nothing gets
     * the terms-and-privacy default — which is why the onboarding steps, past
     * the point where the reader agreed to them, say `null`.
     */
    legalNoteKey?: ParseKeys | null;
    /**
     * How wide the centred column is: `form` (340px, the auth forms), `wide`
     * (400px, the onboarding steps) or `panel` (620px, Add your first host,
     * whose two code cards sit side by side).
     */
    authWidth?: 'form' | 'wide' | 'panel';
  }
}

export interface AuthLayoutProps {
  /** The wordmark's product suffix; defaults to `common.product`. */
  product?: string;
  /**
   * What fills the right half above 900px: the console's photograph carousel,
   * or nothing for an app that has no atmosphere to sell.
   */
  panel?: ReactNode;
  children: ReactNode;
}

const WIDTHS = {
  form: 'max-w-85',
  wide: 'max-w-100',
  panel: 'max-w-[620px]',
} as const;

/**
 * The auth split from the MVP artboards: the wordmark top-left, a 340px form
 * column centred in the left half, the panel on the right. Below 900px the
 * panel drops away and the form takes the width; it carries no information,
 * only atmosphere. An app's `_auth` route mounts this around its `Outlet`,
 * and the guards sit on the children — the sign-in screens turn a signed-in
 * visitor away, the onboarding screens a signed-out one.
 *
 * These screens follow the OS theme: there is no toggle here. Appearance is
 * chosen from the account menu once signed in.
 *
 * How wide the column is and what sits under it are the page's to declare as
 * `staticData`. One walk reads both: the innermost match that *declares* a key
 * wins, which is `in` rather than a truthiness test, because `null` is a
 * legal-note answer and not an absence.
 */
export function AuthLayout({ product, panel, children }: AuthLayoutProps) {
  const { t } = useTranslation();
  const { legalNoteKey, width } = useMatches({
    select: (matches) => {
      let legalNoteKey: ParseKeys | null | undefined;
      let width: keyof typeof WIDTHS | undefined;

      for (let i = matches.length - 1; i >= 0; i -= 1) {
        const declared = matches[i]?.staticData;
        if (!declared) continue;
        if (legalNoteKey === undefined && 'legalNoteKey' in declared) {
          legalNoteKey = declared.legalNoteKey;
        }
        if (width === undefined && declared.authWidth !== undefined) width = declared.authWidth;
      }

      return { legalNoteKey, width: width ?? 'form' };
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

        <div
          className={`mx-auto flex w-full ${WIDTHS[width]} flex-1 flex-col justify-center py-10`}
        >
          {children}

          {legalNoteKey === null ? null : (
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
          )}
        </div>
      </div>

      {panel}
    </div>
  );
}
