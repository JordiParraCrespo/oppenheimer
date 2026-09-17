import { redirect } from '@tanstack/react-router';
import { sanitizeRedirect } from '../../platform';
import type { NavTo } from '../../shell';

interface RedirectSignedInArgs {
  context: { auth: { isAuthenticated: boolean } };
  location: { pathname: string; search: unknown };
  /** Where a signed-in visitor of an auth page is sent when nothing else asks. */
  landing: NavTo;
  /** Auth-layout paths a signed-in visitor may still open (an invitation to redeem). */
  allow?: readonly string[];
}

/**
 * The auth layout's `beforeLoad`: a signed-in visitor has no business on a
 * sign-in screen, so they are sent on — to the `?redirect=` a deep link
 * carried, or to the app's landing.
 *
 * A deep link opened cold is matched before the session store has caught up
 * with the restore query, so `_authenticated` bounces it here with the
 * original path in `redirect`. Honouring it is what lands the reader on the
 * page they asked for instead of the landing screen.
 *
 * Sanitised with the same rule the login form applies before it sends a
 * reader on: `?redirect=https://evil.example` on a link an authenticated
 * reader opens would otherwise be an open redirect.
 */
export function redirectSignedIn({ context, location, landing, allow = [] }: RedirectSignedInArgs) {
  if (!context.auth.isAuthenticated) return;
  if (allow.includes(location.pathname)) return;

  const requested = sanitizeRedirect((location.search as { redirect?: unknown }).redirect);
  if (requested) throw redirect({ href: requested });
  throw redirect({ to: landing });
}
