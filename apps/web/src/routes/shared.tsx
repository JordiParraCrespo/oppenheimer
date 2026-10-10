import { createFileRoute } from '@tanstack/react-router';
import { SharedSessionScreen } from '@/features/sessions/screens/shared-session';

/**
 * A session opened through a share link: `/shared#<secret>`. Outside both
 * `_auth` and `_authenticated`, because its holder may be signed in, signed
 * out, or signed in to another workspace; the API decides what the link
 * opens for whoever they are. The secret is the fragment, so it has no
 * search schema: nothing here is sent to a server by the browser.
 */
export const Route = createFileRoute('/shared')({ component: SharedSessionPage });

function SharedSessionPage() {
  return <SharedSessionScreen />;
}
