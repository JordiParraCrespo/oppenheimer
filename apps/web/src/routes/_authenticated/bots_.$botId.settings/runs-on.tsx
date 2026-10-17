import { createFileRoute, redirect } from '@tanstack/react-router';

/** The page's old address, from when it was called Runs on: it is Home host now. */
export const Route = createFileRoute('/_authenticated/bots_/$botId/settings/runs-on')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/bots/$botId/settings/home-host', params, replace: true });
  },
});
