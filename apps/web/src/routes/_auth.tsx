import { AuthLayout } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AuthPanel } from '@/features/auth/sections/auth-panel';

/**
 * The walk into the console: the sign-in forms under `_public` and the
 * first-run steps under `onboarding`, one layout so their chrome does not
 * drift. The column width and legal line are route `staticData` that
 * `AuthLayout` reads off the innermost match.
 *
 * `_auth` is chrome, not a gate: `_public` turns a signed-in visitor away and
 * `onboarding` a signed-out one, so each child carries its own guard. A
 * `redirectSignedIn` here would bounce the account `_authenticated` sends to
 * `/onboarding` for having no workspace, closing the recovery path
 * (`08-auth.md`).
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
