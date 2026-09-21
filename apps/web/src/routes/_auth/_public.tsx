import { redirectSignedIn } from '@oppenheimer/frontend-web';
import { createFileRoute } from '@tanstack/react-router';

/**
 * The signed-out half of the auth layout: sign in, register, and the two
 * password screens. A signed-in visitor has no business on any of them and is
 * sent to the console, or to wherever the `?redirect=` they arrived with says.
 *
 * Pathless, and with no component of its own: it exists only to hold that one
 * guard, so `onboarding` can sit under the same layout with the opposite one.
 */
export const Route = createFileRoute('/_auth/_public')({
  beforeLoad: ({ context, location }) =>
    redirectSignedIn({ context, location, landing: '/sessions' }),
});
