import { createFileRoute, redirect } from '@tanstack/react-router';

/** `/bots/$botId/settings` opens on Profile, the first page. */
export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/bots/$botId/settings/profile', params, replace: true });
  },
});
