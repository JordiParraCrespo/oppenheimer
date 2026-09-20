import { AuthLayout } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AuthPanel } from '@/features/auth/sections/auth-panel';

/**
 * The numbered onboarding steps and the Ready landing share the auth split:
 * wordmark top-left, a centred column, the photograph carousel on the right.
 * Wider than the auth forms, and with no legal line under them.
 */
export const Route = createFileRoute('/onboarding/_flow')({
  component: OnboardingFlowLayout,
  staticData: { authWidth: 'wide' },
});

function OnboardingFlowLayout() {
  return (
    <AuthLayout
      legal={false}
      panel={
        <AuthPanel className="hidden p-6 min-[900px]:flex min-[900px]:py-10 min-[900px]:pr-10" />
      }
    >
      <Outlet />
    </AuthLayout>
  );
}
