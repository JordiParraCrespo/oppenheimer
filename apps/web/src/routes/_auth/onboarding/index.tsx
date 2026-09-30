import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * `/onboarding` is the door to the walk, not a screen: step 2
 * (`claimPersonalWorkspace`) names the provisioned workspace or creates one
 * when there is none, so it is the recovery path `_authenticated` means when
 * it sends an account with no workspace here (`08-auth.md`).
 */
export const Route = createFileRoute('/_auth/onboarding/')({
  beforeLoad: () => {
    throw redirect({ to: '/onboarding/workspace', replace: true });
  },
});
