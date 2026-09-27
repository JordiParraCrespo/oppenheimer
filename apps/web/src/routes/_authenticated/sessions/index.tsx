import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * The console's own URL, and where nothing is open. It opens New session
 * rather than a pane saying no session is open: that pane's only way on was
 * the composer, so the composer is what `/sessions` shows. The sidebar is
 * beside it either way, for someone who came to pick a session instead.
 *
 * A redirect, not the composer mounted here, so the address is the screen's
 * own and closing a session, signing in or leaving onboarding all land on the
 * same `/sessions/new`.
 */
export const Route = createFileRoute('/_authenticated/sessions/')({
  beforeLoad: () => {
    throw redirect({ to: '/sessions/new', replace: true });
  },
});
