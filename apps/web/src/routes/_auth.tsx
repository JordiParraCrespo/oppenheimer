import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { Trans } from 'react-i18next';
import { AuthLegalNoteProvider } from '@/components/auth/auth-legal-note';
import { AuthPanel } from '@/components/auth/auth-panel';
import { AuthLink } from '@/components/auth/auth-primitives';
import { BrandLogo } from '@/components/auth/brand-logo';
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
 * The auth split from the MVP artboards: the wordmark top-left, a 340px form
 * column centred in the left half, the photograph carousel in a 28px frame
 * on the right. Below 900px the panel drops away and the form takes the
 * width; it carries no information, only atmosphere.
 *
 * These screens follow the OS theme: there is no toggle here. Appearance is
 * chosen from the account menu once signed in.
 */
function AuthLayout() {
  const [legalNote, setLegalNote] = useState<string | null>(null);

  return (
    <div className="grid min-h-svh w-full bg-canvas min-[900px]:grid-cols-2">
      <div className="relative flex flex-col px-6 py-8 min-[900px]:px-11 min-[900px]:py-10">
        <BrandLogo />

        <div className="mx-auto flex w-full max-w-85 flex-1 flex-col justify-center py-10">
          <AuthLegalNoteProvider value={setLegalNote}>
            <Outlet />
          </AuthLegalNoteProvider>

          <p className="mt-5 text-xs text-pretty text-fg-subtle">
            {legalNote ?? (
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

      <AuthPanel className="hidden p-6 min-[900px]:block min-[900px]:py-10 min-[900px]:pr-10" />
    </div>
  );
}
