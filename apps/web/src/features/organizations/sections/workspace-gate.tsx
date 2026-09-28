import { useOrganizations } from '@oppenheimer/frontend-consumer/react';
import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/**
 * The product shell is for people who have somewhere to work.
 *
 * Sign-up creates the personal workspace, but the hook is best-effort, so a
 * signed-in account can end up belonging to none — and the screens in here
 * are scoped to a workspace, which for that account is a refusal. Send them to
 * onboarding, where they create it, instead of letting the app tell them on
 * their first screen that they do not have permission to look at it.
 *
 * The redirect waits for a *settled, successful, empty* list. While the query
 * is in flight — including the background refetch that follows creating the
 * workspace, when the cache still holds the `[]` that sent them to onboarding
 * — or if it failed, the children render as they always did: guessing "nowhere
 * to work" from an unanswered question would bounce every reader out of the
 * app on a network blip, or straight back to the onboarding screen they just
 * left.
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const organizations = useOrganizations();
  const settledEmpty =
    organizations.isSuccess && !organizations.isFetching && organizations.data.length === 0;

  if (settledEmpty) return <Navigate to="/onboarding" replace />;
  return children;
}
