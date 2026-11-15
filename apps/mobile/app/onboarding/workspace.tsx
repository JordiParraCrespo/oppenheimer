import { OnboardingWorkspaceScreen } from '../../features/organizations/screens/onboarding-workspace';
import { webUrl } from '../../lib/auth-client';

export default function WorkspaceStep() {
  return <OnboardingWorkspaceScreen webHost={new URL(webUrl).host} />;
}
