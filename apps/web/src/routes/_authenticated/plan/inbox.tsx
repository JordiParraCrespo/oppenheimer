import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * `/plan/inbox`, where the Inbox lived while it was Plan's first section
 * (2026-10-29 to 2026-11-24): an old link or bookmark goes on to `/inbox`,
 * its search kept for that route's schema to read.
 */
export const Route = createFileRoute('/_authenticated/plan/inbox')({
  beforeLoad: () => {
    throw redirect({ to: '/inbox', search: true, replace: true });
  },
});
