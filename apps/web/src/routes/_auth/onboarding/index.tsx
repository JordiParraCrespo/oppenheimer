import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * `/onboarding` is the walk, not a screen of its own.
 *
 * It used to hold a second create-workspace form, for the account whose
 * sign-up hook did not provision one. That is what step 2 does now:
 * `claimPersonalWorkspace` names the provisioned row and creates when there is
 * none, and the step's gate lets an account with no workspace straight through
 * (`08-auth.md`). So the recovery path is the step, and this is the door to it
 * — which is also what `_authenticated` means when it sends an account with an
 * empty workspace list to `/onboarding`.
 */
export const Route = createFileRoute('/_auth/onboarding/')({
  beforeLoad: () => {
    throw redirect({ to: '/onboarding/workspace', replace: true });
  },
});
