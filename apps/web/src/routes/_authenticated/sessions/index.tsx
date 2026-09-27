import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/sessions/')({
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/sessions/new', search, replace: true });
  },
});
