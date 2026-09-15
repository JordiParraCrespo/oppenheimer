import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthArtPanel } from '@/components/auth/auth-art-panel';
import { AuthLegalNoteProvider } from '@/components/auth/auth-legal-note';
import { BrandLogo } from '@/components/auth/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { sanitizeRedirect } from '@/lib/sanitize-redirect';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) return;

    // A signed-in invitee still has to redeem the invitation. Keep this one
    // auth-layout route reachable so an existing user can sign in and return
    // to the same link instead of being bounced to the sessions list first.
    if (location.pathname === '/accept-invitation') return;

    // A deep link opened cold is matched before the session store has caught
    // up with the restore query, so `_authenticated` bounces it here with the
    // original path in `redirect`. Honour it: without this the reader silently
    // lands on the sessions list instead of the page they asked for.
    //
    // Sanitised with the same rule the login form applies before it sends a
    // reader on: `?redirect=https://evil.example` on a link an authenticated
    // reader opens would otherwise be an open redirect.
    const requested = sanitizeRedirect((location.search as { redirect?: unknown }).redirect);

    if (requested) throw redirect({ href: requested });
    throw redirect({ to: '/sessions' });
  },
  component: AuthLayout,
});

/**
 * The auth split: form on the left, aurora panel on the right. Below 900px the
 * panel drops away entirely and the form takes the full width — it carries no
 * information, only atmosphere.
 */
function AuthLayout() {
  const { t } = useTranslation();
  const [legalNote, setLegalNote] = useState<string | null>(null);

  return (
    <div className="grid h-svh w-full bg-background min-[900px]:grid-cols-2">
      <div className="relative flex flex-col overflow-y-auto px-6 py-10 min-[900px]:px-14">
        {/* The design puts one control in this corner and nothing else: the
            theme pill, at 40px from the top and the panel's own 56px gutter. */}
        <ThemeToggle className="absolute top-8 right-6 z-10 min-[900px]:top-10 min-[900px]:right-14" />

        <BrandLogo />

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-6">
          <AuthLegalNoteProvider value={setLegalNote}>
            <Outlet />
          </AuthLegalNoteProvider>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-400">
          {legalNote && <p className="basis-full">{legalNote}</p>}
          <Link to="/privacy" className="hover:text-ink-700">
            {t('public.navigation.privacy')}
          </Link>
          <Link to="/terms" className="hover:text-ink-700">
            {t('public.navigation.terms')}
          </Link>
        </div>
      </div>

      <AuthArtPanel className="hidden min-[900px]:flex" />
    </div>
  );
}
