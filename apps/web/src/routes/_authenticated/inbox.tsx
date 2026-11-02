import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * `/inbox`, where the Inbox lived before it moved into Plan (the 2026-10-29
 * frame): an old link or bookmark goes on to `/plan/inbox`, its search kept
 * for that route's schema to read.
 */
export const Route = createFileRoute('/_authenticated/inbox')({
  beforeLoad: () => {
    throw redirect({ to: '/plan/inbox', search: true, replace: true });
  },
});
