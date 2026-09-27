import { isProvisionalSlug } from '@oppenheimer/frontend-consumer';
import { useOrganizations } from '@oppenheimer/frontend-consumer/react';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { OnboardingWorkspaceScreen } from '@/features/organizations/screens/onboarding-workspace';

export const Route = createFileRoute('/_auth/onboarding/workspace')({
  component: WorkspaceStep,
});

/**
 * The first-run gate.
 *
 * `08-auth.md` says an account that already has a workspace belongs in the
 * console, not in the step that names one — sign-up routes here, but nothing
 * stopped a finished account walking the form again and re-submitting a name
 * it had already chosen.
 *
 * The test is whether the address has been claimed, not whether a workspace
 * exists: sign-up provisions one for everybody, so its mere presence would
 * send every new account straight past the step it was sent here for.
 *
 * Only a *settled, successful* read redirects. An unanswered query says
 * nothing about what the account has, and guessing would bounce a reader out
 * of first-run on a network blip.
 *
 * And it is decided once, on arrival. Submitting the step claims the address,
 * and the claim writes the named workspace into the cache before the screen
 * navigates on to GitHub — a gate that kept reading the list would see
 * "claimed" and send the newcomer to the console, past the rest of the walk.
 */
function WorkspaceStep() {
  const { data: organizations, isSuccess } = useOrganizations();
  const [claimedOnArrival, setClaimedOnArrival] = useState<boolean | null>(null);

  if (claimedOnArrival === null && isSuccess) {
    setClaimedOnArrival(organizations[0] ? !isProvisionalSlug(organizations[0].slug) : false);
  }

  if (claimedOnArrival) return <Navigate to="/sessions" replace />;

  return <OnboardingWorkspaceScreen />;
}
