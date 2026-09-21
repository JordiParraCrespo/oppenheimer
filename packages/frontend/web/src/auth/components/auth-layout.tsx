import { type StaticDataRouteOption, useMatches } from '@tanstack/react-router';
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

const WIDTHS = {
  form: 'max-w-85',
  wide: 'max-w-100',
  panel: 'max-w-[620px]',
} as const;

/**
 * The innermost match that declares a piece of framing wins, so a page
 * overrides its layout and a page that declares nothing inherits. `undefined`,
 * not falsiness, is what counts as declaring nothing — `authLegal` is a
 * boolean whose whole purpose is to be `false`.
 *
 * It takes the matches rather than calling `useMatches` itself: each caller
 * below selects a concrete type, which is what lets the router infer what the
 * selector returns.
 */
function innermost<T>(
  matches: ReadonlyArray<{ staticData: StaticDataRouteOption }>,
  pick: (staticData: StaticDataRouteOption) => T | undefined,
): T | undefined {
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i];
    const value = match && pick(match.staticData);
    if (value !== undefined) return value;
  }
  return undefined;
}

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
 * How wide the column is, whether the legal one-liner sits under it and which
 * line it is are the page's to declare as `staticData`.
 */
export function AuthLayout({ product, panel, children }: AuthLayoutProps) {
  const { t } = useTranslation();
  const legalNoteKey = useMatches({ select: (m) => innermost(m, (d) => d.legalNoteKey) });
  const width = useMatches({ select: (m) => innermost(m, (d) => d.authWidth) ?? 'form' });
  const legal = useMatches({ select: (m) => innermost(m, (d) => d.authLegal) ?? true });

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

          {legal ? (
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
          ) : null}
        </div>
      </div>

      {panel}
    </div>
  );
}
