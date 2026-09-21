import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * Everything under `/onboarding` is for a signed-in account: the recovery
 * screen at the index, and the numbered steps beside it. A signed-out visitor
 * is sent to the login page and returned here.
 *
 * The steps are reached after sign-up, so the terms-and-privacy line under the
 * column would be restating what the reader already agreed to; the column
 * itself is a size up from the forms. `Add your first host` widens it again.
 */
export const Route = createFileRoute('/_auth/onboarding')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  staticData: { authWidth: 'wide', authLegal: false },
});
