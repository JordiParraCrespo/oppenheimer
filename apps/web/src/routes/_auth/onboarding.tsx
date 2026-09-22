import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * Everything under `/onboarding` is for a signed-in account: the numbered
 * first-run steps. A signed-out visitor is sent to the login page and
 * returned here.
 *
 * `_auth` carries the split screen but no guard, because its other subtree
 * wants the opposite one; this is where the signed-in half is decided. The
 * steps are walked once the account exists, so the terms-and-privacy line
 * under the column would restate what the reader has already agreed to —
 * `legalNoteKey: null` is how a page says "no line". The column is a size up
 * from the forms; `Add your first host` widens it again.
 */
export const Route = createFileRoute('/_auth/onboarding')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  staticData: { authWidth: 'wide', legalNoteKey: null },
});
