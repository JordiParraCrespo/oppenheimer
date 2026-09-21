import { AuthLayout } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AuthPanel } from '@/features/auth/sections/auth-panel';

/**
 * Everything a reader sees before they are inside the console shares this
 * split: the sign-in forms under `_public`, and the first-run flow under
 * `onboarding`. One layout, so the wordmark, the column and the photograph
 * carousel do not drift apart between the two halves of the same walk.
 *
 * The guards are the children's, because they are opposites: `_public` sends a
 * signed-in visitor on, `onboarding` sends a signed-out one to the login page.
 * What varies per page — the column width, the legal line — is route
 * `staticData` that `AuthLayout` reads off the innermost match.
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
