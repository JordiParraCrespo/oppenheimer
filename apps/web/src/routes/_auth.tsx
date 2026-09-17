import { AuthLayout, redirectSignedIn } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AuthPanel } from '@/features/auth/sections/auth-panel';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context, location }) =>
    redirectSignedIn({ context, location, landing: '/sessions' }),
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
