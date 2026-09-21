import { createFileRoute } from '@tanstack/react-router';
import { NotFoundScreen } from '@/features/public/screens/not-found';

/**
 * Everything else.
 *
 * The catch-all sits *under* the authenticated layout on purpose: a mistyped
 * URL is answered inside the console, with the sidebar still there, and a
 * signed-out reader who follows a dead link is sent to sign in and brought
 * back — both of which the layout above already does. Real routes are more
 * specific, so none of them is shadowed by this one.
 */
export const Route = createFileRoute('/_authenticated/$')({
  component: NotFoundScreen,
  staticData: { pane: 'full' },
});
