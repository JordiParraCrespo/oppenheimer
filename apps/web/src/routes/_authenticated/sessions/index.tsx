import { RouteError } from '@oppenheimer/frontend-web';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/sessions/')({
  // Its own boundary, so a thrown render replaces this pane and not the
  // shell around it: without one the error climbs to `_authenticated`.
  errorComponent: RouteError,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/sessions/new', search, replace: true });
  },
});
