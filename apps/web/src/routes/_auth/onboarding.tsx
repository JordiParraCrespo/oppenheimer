import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * Everything under `/onboarding` is for a signed-in account; a signed-out
 * visitor goes to login and back. `_auth` carries no guard because its other
 * subtree wants the opposite one. The steps come after the terms were agreed
 * to, so there is no legal line (`legalNoteKey: null`).
 */
export const Route = createFileRoute('/_auth/onboarding')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  staticData: { authWidth: 'wide', legalNoteKey: null },
});
