import { useOrganizations, useWorkspaceEvents } from '@oppenheimer/frontend-consumer/react';
import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/**
 * Sign-up's workspace hook is best-effort, so an account can belong to no
 * workspace, and every screen in here would refuse it; send it to onboarding
 * instead. The redirect waits for a *settled, successful, empty* list: while
 * in flight (including the refetch after creating the workspace, when the
 * cache still holds `[]`) or failed, the children render, or a network blip
 * would bounce every reader out of the app or back to onboarding.
 *
 * Past the gate the console is in a workspace, so this is also where the
 * workspace's change feed is held open, once, for every screen inside.
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const organizations = useOrganizations();
  useWorkspaceEvents();
  const settledEmpty =
    organizations.isSuccess && !organizations.isFetching && organizations.data.length === 0;

  if (settledEmpty) return <Navigate to="/onboarding" replace />;
  return children;
}
