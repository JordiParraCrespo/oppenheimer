import { RouteError } from '@oppenheimer/frontend-web';
import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/settings` is no page of its own: the first section is Profile. */
export const Route = createFileRoute('/_authenticated/settings/')({
  // Its own boundary, so a thrown render replaces this pane and not the
  // shell around it: without one the error climbs to `_authenticated`.
  errorComponent: RouteError,
  beforeLoad: () => {
    throw redirect({ to: '/settings/profile', replace: true });
  },
});
