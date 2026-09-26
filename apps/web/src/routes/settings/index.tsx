import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/settings` is no page of its own: the first section is Profile. */
export const Route = createFileRoute('/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/profile', replace: true });
  },
});
