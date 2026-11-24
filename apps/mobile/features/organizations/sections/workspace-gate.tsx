import { useOrganizations } from '@oppenheimer/frontend-consumer/react';
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

/**
 * An account with no workspace has nowhere to work, and every screen past
 * here would refuse it; it goes to the step that makes one, as the console
 * does. Only a settled, successful empty answer decides: an unanswered query
 * says nothing, and guessing would bounce a reader out on a network blip.
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { data, isSuccess } = useOrganizations();
  if (isSuccess && data.length === 0) return <Redirect href="/onboarding/workspace" />;
  return children;
}
