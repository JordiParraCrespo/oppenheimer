import { createFileRoute } from '@tanstack/react-router';
import { SharedSessionScreen } from '@/features/sessions/screens/shared-session';

/**
 * A shared session, as a guest opens it: `/s/<slug>`. Outside both `_auth`
 * and `_authenticated`, because a guest may be signed out (the page asks
 * them to sign in and comes back here), or signed in to another workspace;
 * the API decides what the share opens for whoever they are.
 */
export const Route = createFileRoute('/s/$slug')({ component: SharedSessionPage });

function SharedSessionPage() {
  const { slug } = Route.useParams();
  return <SharedSessionScreen slug={slug} />;
}
