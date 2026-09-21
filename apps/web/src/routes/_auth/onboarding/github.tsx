import { createFileRoute } from '@tanstack/react-router';
import { OnboardingGithubScreen } from '@/features/organizations/screens/onboarding-github';

export const Route = createFileRoute('/_auth/onboarding/github')({
  component: OnboardingGithubScreen,
});
