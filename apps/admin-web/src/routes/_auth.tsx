import { AuthLayout, redirectSignedIn } from '@oppenheimer/frontend-web';
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context, location }) => redirectSignedIn({ context, location, landing: '/users' }),
  component: ControlPlaneAuthLayout,
});

/** The control plane's auth column: its own product suffix, no photograph panel. */
function ControlPlaneAuthLayout() {
  return (
    <AuthLayout product="Control">
      <Outlet />
    </AuthLayout>
  );
}
