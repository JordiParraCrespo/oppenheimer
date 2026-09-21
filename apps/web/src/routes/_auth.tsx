import { AuthLayout } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AuthPanel } from '@/features/auth/sections/auth-panel';

/**
 * The walk into the console: the sign-in forms under `_public`, the first-run
 * steps under `onboarding`. One layout, so the wordmark, the column and the
 * photograph carousel do not drift apart between the two halves of the same
 * walk. What varies per page — the column width, the legal line — is route
 * `staticData` that `AuthLayout` reads off the innermost match.
 *
 * `_auth` is chrome, not a gate. Its two subtrees want opposite guards —
 * `_public` turns a signed-in visitor away, `onboarding` a signed-out one — so
 * each child carries its own and this route carries none.
 *
 * That is what makes the hand-off with `_authenticated` work, and it is easy
 * to break from here. `_authenticated` is the product shell, and it sends an
 * account with no workspace to `/onboarding` — which lives under this layout
 * and is for signed-in readers. A `redirectSignedIn` on *this* route would
 * bounce them straight back out, and the recovery path would close. Guards
 * belong on the children (`08-auth.md`).
 */
export const Route = createFileRoute('/_auth')({
  component: ConsumerAuthLayout,
});

function ConsumerAuthLayout() {
  return (
    <AuthLayout
      panel={
        <AuthPanel className="hidden p-6 min-[900px]:flex min-[900px]:py-10 min-[900px]:pr-10" />
      }
    >
      <Outlet />
    </AuthLayout>
  );
}
