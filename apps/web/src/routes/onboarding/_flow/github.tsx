import { createFileRoute } from '@tanstack/react-router';
import { OnboardingGithubScreen } from '@/features/organizations/screens/onboarding-github';

export const Route = createFileRoute('/onboarding/_flow/github')({
  component: OnboardingGithubScreen,
});
