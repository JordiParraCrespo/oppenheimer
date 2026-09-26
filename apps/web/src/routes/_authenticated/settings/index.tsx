import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/settings` opens on its one section today. */
export const Route = createFileRoute('/_authenticated/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/hosts', replace: true });
  },
});
