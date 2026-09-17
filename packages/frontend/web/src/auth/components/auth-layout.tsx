import { Link, useMatches } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavTo } from '../../shell';
import { ThemeToggle } from '../../theme';
import '../lib/legal-note';
import { AuthArtPanel } from './auth-art-panel';
import { BrandLogo } from './brand-logo';

export interface AuthLayoutProps {
  /** The wordmark's label; defaults to the product name. */
  brandLabel?: string;
  /** Footer links (privacy, terms). None for a control plane with no public pages. */
  links?: readonly { to: NavTo; label: string }[];
  /** Which product's copy the art panel shows. */
  copy?: 'consumer' | 'control';
  children: ReactNode;
}

/**
 * The auth split: form on the left, aurora panel on the right. Below 900px the
 * panel drops away entirely and the form takes the full width — it carries no
 * information, only atmosphere. An app's `_auth` route mounts this around its
 * `Outlet`, after `redirectSignedIn` has decided who may be here.
 */
export function AuthLayout({ brandLabel, links = [], copy, children }: AuthLayoutProps) {
  const { t } = useTranslation();
  // The innermost match that declares a note wins, so a page overrides its
  // layout and a page without one shows nothing.
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
    <div className="grid h-svh w-full bg-background min-[900px]:grid-cols-2">
      <div className="relative flex flex-col overflow-y-auto px-6 py-10 min-[900px]:px-14">
        {/* The design puts one control in this corner and nothing else: the
            theme pill, at 40px from the top and the panel's own 56px gutter. */}
        <ThemeToggle className="absolute top-8 right-6 z-10 min-[900px]:top-10 min-[900px]:right-14" />

        <BrandLogo label={brandLabel} />

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-6">
          {children}
        </div>

        {(legalNoteKey || links.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-400">
            {legalNoteKey && <p className="basis-full">{t(legalNoteKey)}</p>}
            {links.map((link) => (
              <Link key={link.to} to={link.to} className="hover:text-ink-700">
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <AuthArtPanel className="hidden min-[900px]:flex" copy={copy} />
    </div>
  );
}
